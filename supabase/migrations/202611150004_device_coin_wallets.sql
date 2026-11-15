-- STREET LIFE: device-scoped shared Street Coin wallets.
-- This migration creates the secure wallet ledger only. App traffic is switched
-- to it in a later change after every coin source/spend path has been migrated.
-- Existing players.coins values are migrated at most once per Telegram account,
-- to the first device wallet that account uses. They are never copied to every phone.

create table if not exists public.device_coin_wallets (
  id uuid primary key default gen_random_uuid(),
  device_key_hash text not null unique
    check (device_key_hash ~ '^[0-9a-f]{64}$'),
  balance bigint not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.device_coin_wallet_players (
  wallet_id uuid not null references public.device_coin_wallets(id) on delete cascade,
  telegram_id bigint not null references public.players(telegram_id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key (wallet_id, telegram_id)
);

create index if not exists device_coin_wallet_players_telegram_idx
  on public.device_coin_wallet_players (telegram_id);

-- Records the one-time legacy migration for each Telegram account so an
-- existing account balance cannot be cloned onto multiple physical devices.
create table if not exists public.device_coin_legacy_migrations (
  telegram_id bigint primary key references public.players(telegram_id) on delete cascade,
  wallet_id uuid not null references public.device_coin_wallets(id),
  legacy_balance bigint not null default 0,
  migrated_at timestamptz not null default now()
);

create table if not exists public.device_coin_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.device_coin_wallets(id) on delete cascade,
  telegram_id bigint not null references public.players(telegram_id) on delete cascade,
  event_key text not null unique,
  amount bigint not null check (amount <> 0),
  balance_after bigint not null check (balance_after >= 0),
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists device_coin_wallet_transactions_wallet_time_idx
  on public.device_coin_wallet_transactions (wallet_id, created_at desc);

alter table public.device_coin_wallets enable row level security;
alter table public.device_coin_wallet_players enable row level security;
alter table public.device_coin_legacy_migrations enable row level security;
alter table public.device_coin_wallet_transactions enable row level security;

revoke all on public.device_coin_wallets from anon, authenticated;
revoke all on public.device_coin_wallet_players from anon, authenticated;
revoke all on public.device_coin_legacy_migrations from anon, authenticated;
revoke all on public.device_coin_wallet_transactions from anon, authenticated;

grant select, insert, update, delete on public.device_coin_wallets to service_role;
grant select, insert, update, delete on public.device_coin_wallet_players to service_role;
grant select, insert, update, delete on public.device_coin_legacy_migrations to service_role;
grant select, insert, update, delete on public.device_coin_wallet_transactions to service_role;

create or replace function public.get_or_create_device_coin_wallet(
  p_telegram_id bigint,
  p_device_key_hash text
)
returns table(wallet_id uuid, balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_balance bigint;
  v_legacy_balance bigint;
begin
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'Invalid Telegram player ID';
  end if;
  if p_device_key_hash is null or p_device_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid device key';
  end if;
  if not exists (select 1 from public.players p where p.telegram_id = p_telegram_id) then
    raise exception 'Registered player not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_device_key_hash, 0));
  perform pg_advisory_xact_lock(p_telegram_id);

  insert into public.device_coin_wallets(device_key_hash)
  values (p_device_key_hash)
  on conflict (device_key_hash) do nothing;

  select w.id, w.balance
    into v_wallet_id, v_balance
  from public.device_coin_wallets w
  where w.device_key_hash = p_device_key_hash
  for update;

  insert into public.device_coin_wallet_players(wallet_id, telegram_id)
  values (v_wallet_id, p_telegram_id)
  on conflict (wallet_id, telegram_id) do nothing;

  -- Migrate a player's old account balance once only. When another account
  -- joins this same phone, use the larger existing balance rather than adding
  -- two old account balances together and duplicating starter coins.
  if not exists (
    select 1 from public.device_coin_legacy_migrations m
    where m.telegram_id = p_telegram_id
  ) then
    select greatest(coalesce(p.coins, 0), 0)::bigint
      into v_legacy_balance
    from public.players p
    where p.telegram_id = p_telegram_id;

    insert into public.device_coin_legacy_migrations
      (telegram_id, wallet_id, legacy_balance)
    values (p_telegram_id, v_wallet_id, coalesce(v_legacy_balance, 0))
    on conflict (telegram_id) do nothing;

    if found then
      update public.device_coin_wallets w
      set balance = greatest(w.balance, coalesce(v_legacy_balance, 0)),
          updated_at = now()
      where w.id = v_wallet_id
      returning w.balance into v_balance;
    end if;
  end if;

  return query select v_wallet_id, v_balance;
end;
$$;

create or replace function public.change_device_coin_balance(
  p_telegram_id bigint,
  p_device_key_hash text,
  p_event_key text,
  p_amount bigint,
  p_reason text
)
returns table(success boolean, already_applied boolean, new_balance bigint, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_balance bigint;
  v_existing public.device_coin_wallet_transactions%rowtype;
begin
  if p_event_key is null or length(trim(p_event_key)) < 8 or length(p_event_key) > 180 then
    raise exception 'Invalid wallet event key';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'Wallet change amount must not be zero';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Wallet change reason is required';
  end if;

  select w.wallet_id, w.balance
    into v_wallet_id, v_balance
  from public.get_or_create_device_coin_wallet(p_telegram_id, p_device_key_hash) w;

  -- Lock the wallet before checking the idempotency key so two concurrent
  -- retries cannot both pass the duplicate check and race to credit it.
  select w.balance into v_balance
  from public.device_coin_wallets w
  where w.id = v_wallet_id
  for update;

  select * into v_existing
  from public.device_coin_wallet_transactions t
  where t.event_key = p_event_key;

  if found then
    if v_existing.wallet_id <> v_wallet_id or
       v_existing.telegram_id <> p_telegram_id or
       v_existing.amount <> p_amount then
      raise exception 'Wallet event key was already used for a different transaction';
    end if;
    return query select true, true, v_existing.balance_after, 'Already applied'::text;
    return;
  end if;

  if p_amount < 0 and v_balance < abs(p_amount) then
    return query select false, false, v_balance, 'Insufficient Street Coins'::text;
    return;
  end if;

  update public.device_coin_wallets w
  set balance = w.balance + p_amount,
      updated_at = now()
  where w.id = v_wallet_id
  returning w.balance into v_balance;

  insert into public.device_coin_wallet_transactions
    (wallet_id, telegram_id, event_key, amount, balance_after, reason)
  values
    (v_wallet_id, p_telegram_id, p_event_key, p_amount, v_balance, trim(p_reason));

  return query select true, false, v_balance, 'Wallet updated'::text;
end;
$$;

revoke all on function public.get_or_create_device_coin_wallet(bigint, text) from public, anon, authenticated;
revoke all on function public.change_device_coin_balance(bigint, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.get_or_create_device_coin_wallet(bigint, text) to service_role;
grant execute on function public.change_device_coin_balance(bigint, text, text, bigint, text) to service_role;
