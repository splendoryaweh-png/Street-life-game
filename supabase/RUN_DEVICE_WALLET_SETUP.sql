-- STREET LIFE device-wallet and referral preparation.
-- Run only after confirming migrations 001-003 are already applied.
-- Safe additive setup; this does not deploy application code.

-- =====================================================================
-- 202611150004_device_coin_wallets.sql
-- =====================================================================
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


-- =====================================================================
-- 202611150005_secure_referrals.sql
-- =====================================================================
-- STREET LIFE secure referrals: preserve existing codes and backfill missing ones.
create extension if not exists pgcrypto;

do $$
declare r record; v_code text;
begin
  for r in select telegram_id from public.players
    where referral_code is null or length(trim(referral_code)) = 0
    order by telegram_id
  loop
    loop
      v_code := 'SL' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 7));
      exit when not exists (select 1 from public.players where upper(trim(coalesce(referral_code,''))) = v_code);
    end loop;
    update public.players set referral_code=v_code, updated_at=now()
    where telegram_id=r.telegram_id and (referral_code is null or length(trim(referral_code))=0);
  end loop;
end $$;

create unique index if not exists players_referral_code_upper_uidx
on public.players (upper(trim(referral_code)))
where referral_code is not null and length(trim(referral_code)) > 0;

create or replace function public.claim_streetlife_referral(
  p_invitee_telegram_id bigint,
  p_inviter_code text,
  p_username text default null,
  p_first_name text default null,
  p_last_name text default null,
  p_photo_url text default null
)
returns table(success boolean, message text, invitee_bonus bigint, inviter_bonus bigint, invitee_referral_code text, referrals_count bigint)
language plpgsql security definer set search_path=public
as $$
declare
  v_inviter_id bigint;
  v_code text := upper(trim(coalesce(p_inviter_code,'')));
  v_new_code text;
  v_invitee_code text;
  v_count bigint;
begin
  if p_invitee_telegram_id is null or p_invitee_telegram_id <= 0 then
    raise exception 'Invalid invited player';
  end if;
  if v_code = '' then
    return query select false,'Please enter a referral code.'::text,0::bigint,0::bigint,null::text,0::bigint; return;
  end if;
  perform pg_advisory_xact_lock(p_invitee_telegram_id);

  select telegram_id into v_inviter_id from public.players
    where upper(trim(referral_code))=v_code limit 1;
  if v_inviter_id is null then
    return query select false,'Referral code not found. Check the code with your inviter.'::text,0::bigint,0::bigint,null::text,0::bigint; return;
  end if;
  if v_inviter_id=p_invitee_telegram_id then
    return query select false,'You cannot use your own referral code.'::text,0::bigint,0::bigint,null::text,0::bigint; return;
  end if;

  -- Create/update the verified Telegram player row, so a fresh Mini App launch
  -- can be registered during its first referral claim.
  insert into public.players(telegram_id,username,first_name,last_name,photo_url,coins,created_at,updated_at)
  values(p_invitee_telegram_id,p_username,p_first_name,p_last_name,p_photo_url,0,now(),now())
  on conflict(telegram_id) do update set
    username=coalesce(excluded.username,players.username),
    first_name=coalesce(excluded.first_name,players.first_name),
    last_name=coalesce(excluded.last_name,players.last_name),
    photo_url=coalesce(excluded.photo_url,players.photo_url),
    updated_at=now();

  select referral_code into v_invitee_code from public.players where telegram_id=p_invitee_telegram_id for update;
  if v_invitee_code is null or length(trim(v_invitee_code))=0 then
    loop
      v_new_code := 'SL' || upper(substr(encode(gen_random_bytes(6),'hex'),1,7));
      exit when not exists(select 1 from public.players where upper(trim(coalesce(referral_code,'')))=v_new_code);
    end loop;
    update public.players set referral_code=v_new_code,updated_at=now()
      where telegram_id=p_invitee_telegram_id returning referral_code into v_invitee_code;
  end if;

  perform 1 from public.players where telegram_id in(p_invitee_telegram_id,v_inviter_id) order by telegram_id for update;
  if exists(select 1 from public.players where telegram_id=p_invitee_telegram_id
    and (coalesce(referred_by,'')<>'' or coalesce(referred_by_code,'')<>'')) then
    return query select false,'A referral has already been claimed on this account.'::text,0::bigint,0::bigint,v_invitee_code,0::bigint; return;
  end if;

  update public.players set coins=coalesce(coins,0)+520,referred_by=v_inviter_id::text,
    referred_by_code=v_code,updated_at=now() where telegram_id=p_invitee_telegram_id;
  update public.players set coins=coalesce(coins,0)+100,updated_at=now() where telegram_id=v_inviter_id;
  select count(*) into v_count from public.players where referred_by=v_inviter_id::text;
  return query select true,'Referral accepted! 520 Street Coins added; your inviter received 100.'::text,
    520::bigint,100::bigint,v_invitee_code,v_count;
end $$;

revoke all on function public.claim_streetlife_referral(bigint,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_streetlife_referral(bigint,text,text,text,text,text) to service_role;


-- =====================================================================
-- 202611150006_device_referral_wallets.sql
-- =====================================================================
-- Referral rewards are routed to the exact device wallets involved.
create extension if not exists pgcrypto;

create table if not exists public.device_referral_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  inviter_telegram_id bigint not null references public.players(telegram_id),
  inviter_wallet_id uuid not null references public.device_coin_wallets(id),
  referral_code text not null,
  created_at timestamptz not null default now(),
  active boolean not null default true
);
create table if not exists public.device_referral_claims (
  invitee_telegram_id bigint primary key references public.players(telegram_id),
  link_id uuid not null references public.device_referral_links(id),
  invitee_wallet_id uuid not null references public.device_coin_wallets(id),
  inviter_wallet_id uuid not null references public.device_coin_wallets(id),
  created_at timestamptz not null default now()
);
alter table public.device_referral_links enable row level security;
alter table public.device_referral_claims enable row level security;
revoke all on public.device_referral_links, public.device_referral_claims from anon, authenticated;
grant select,insert,update,delete on public.device_referral_links, public.device_referral_claims to service_role;

create or replace function public.create_device_referral_link(
 p_telegram_id bigint, p_device_key_hash text, p_token_hash text
) returns table(referral_code text)
language plpgsql security definer set search_path=public as $$
declare v_wallet uuid; v_code text;
begin
 select wallet_id into v_wallet from public.get_or_create_device_coin_wallet(p_telegram_id,p_device_key_hash);
 select p.referral_code into v_code from public.players p where p.telegram_id=p_telegram_id;
 if v_code is null or trim(v_code)='' then raise exception 'Referral code missing'; end if;
 insert into public.device_referral_links(token_hash,inviter_telegram_id,inviter_wallet_id,referral_code)
 values(p_token_hash,p_telegram_id,v_wallet,v_code);
 return query select v_code;
end $$;

create or replace function public.claim_device_referral(
 p_invitee_telegram_id bigint,
 p_invitee_device_key_hash text,
 p_token_hash text
) returns table(success boolean,message text,invitee_bonus bigint,inviter_bonus bigint,invitee_balance bigint,referrals_count bigint)
language plpgsql security definer set search_path=public as $$
declare
 v_link public.device_referral_links%rowtype;
 v_invitee_wallet uuid;
 v_invitee_balance bigint;
 v_inviter_balance bigint;
 v_count bigint;
begin
 perform pg_advisory_xact_lock(p_invitee_telegram_id);
 select * into v_link from public.device_referral_links where token_hash=p_token_hash and active=true;
 if not found then return query select false,'Referral link is invalid or expired.'::text,0::bigint,0::bigint,0::bigint,0::bigint; return; end if;
 if v_link.inviter_telegram_id=p_invitee_telegram_id then
  return query select false,'You cannot use your own referral link.'::text,0::bigint,0::bigint,0::bigint,0::bigint; return;
 end if;
 if exists(select 1 from public.device_referral_claims where invitee_telegram_id=p_invitee_telegram_id) then
  return query select false,'A referral has already been claimed on this account.'::text,0::bigint,0::bigint,0::bigint,0::bigint; return;
 end if;
 if not exists(select 1 from public.players where telegram_id=p_invitee_telegram_id) then
  return query select false,'Player account is not registered.'::text,0::bigint,0::bigint,0::bigint,0::bigint; return;
 end if;
 select wallet_id,balance into v_invitee_wallet,v_invitee_balance
 from public.get_or_create_device_coin_wallet(p_invitee_telegram_id,p_invitee_device_key_hash);
 perform 1 from public.device_coin_wallets where id in(v_invitee_wallet,v_link.inviter_wallet_id) order by id for update;
 update public.device_coin_wallets set balance=balance+520,updated_at=now()
 where id=v_invitee_wallet returning balance into v_invitee_balance;
 update public.device_coin_wallets set balance=balance+100,updated_at=now()
 where id=v_link.inviter_wallet_id returning balance into v_inviter_balance;
 insert into public.device_coin_wallet_transactions(wallet_id,telegram_id,event_key,amount,balance_after,reason)
 values
 (v_invitee_wallet,p_invitee_telegram_id,'referral-invitee:'||p_invitee_telegram_id,520,v_invitee_balance,'Referral welcome bonus'),
 (v_link.inviter_wallet_id,v_link.inviter_telegram_id,'referral-inviter:'||p_invitee_telegram_id,100,v_inviter_balance,'Successful referral reward');
 insert into public.device_referral_claims(invitee_telegram_id,link_id,invitee_wallet_id,inviter_wallet_id)
 values(p_invitee_telegram_id,v_link.id,v_invitee_wallet,v_link.inviter_wallet_id);
 update public.players set referred_by=v_link.inviter_telegram_id::text,referred_by_code=v_link.referral_code,updated_at=now()
 where telegram_id=p_invitee_telegram_id;
 select count(*) into v_count from public.device_referral_claims c join public.device_referral_links l on l.id=c.link_id
 where l.inviter_telegram_id=v_link.inviter_telegram_id;
 return query select true,'Referral accepted! 520 coins added to your phone wallet; your inviter received 100 on the phone that created this link.'::text,520::bigint,100::bigint,v_invitee_balance,v_count;
end $$;
revoke all on function public.create_device_referral_link(bigint,text,text) from public,anon,authenticated;
revoke all on function public.claim_device_referral(bigint,text,text) from public,anon,authenticated;
grant execute on function public.create_device_referral_link(bigint,text,text) to service_role;
grant execute on function public.claim_device_referral(bigint,text,text) to service_role;


-- =====================================================================
-- 202611150007_daily_login_device_wallet.sql
-- =====================================================================
-- Daily login rewards credited to the device-scoped Street Coin wallet.
-- Existing daily claims are not paid again. New claims update wallet + ledger atomically.
create or replace function public.claim_streetlife_daily_login_device(
  p_telegram_id bigint,
  p_device_key_hash text
)
returns table(
  success boolean,
  already_claimed boolean,
  reward_sc integer,
  streak_day integer,
  perk text,
  claim_date date,
  wallet_balance bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_yesterday date := ((now() at time zone 'Africa/Lagos')::date - 1);
  v_previous_streak integer;
  v_streak integer;
  v_reward integer;
  v_perk text;
  v_existing public.daily_login_claims%rowtype;
  v_wallet_id uuid;
  v_balance bigint;
  v_event_key text;
begin
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'Invalid Telegram player ID';
  end if;

  perform pg_advisory_xact_lock(p_telegram_id);

  select * into v_existing
  from public.daily_login_claims d
  where d.telegram_id = p_telegram_id and d.claim_date = v_today;

  select w.wallet_id, w.balance into v_wallet_id, v_balance
  from public.get_or_create_device_coin_wallet(p_telegram_id, p_device_key_hash) w;

  if v_existing.telegram_id is not null then
    return query select true, true, v_existing.reward_sc, v_existing.streak_day,
      v_existing.perk, v_today, v_balance;
    return;
  end if;

  select d.streak_day into v_previous_streak
  from public.daily_login_claims d
  where d.telegram_id = p_telegram_id and d.claim_date = v_yesterday
  order by d.created_at desc limit 1;

  v_streak := case when v_previous_streak is null then 1
    when v_previous_streak >= 7 then 1 else v_previous_streak + 1 end;

  case v_streak
    when 1 then v_reward := 100; v_perk := '+1 Free Nitro';
    when 2 then v_reward := 200; v_perk := '+2 Free Coin Packs';
    when 3 then v_reward := 300; v_perk := '+1 Shooter Power-up';
    when 4 then v_reward := 400; v_perk := '+3 Free Nitro';
    when 5 then v_reward := 500; v_perk := '+5 Slot Free Spins';
    when 6 then v_reward := 600; v_perk := '+1 Shield Power-up';
    else v_reward := 1500 + floor(random() * 1501)::integer;
      v_perk := 'Jackpot Box (1500-3000 SC)';
  end case;

  insert into public.daily_login_claims (telegram_id, claim_date, streak_day, reward_sc, perk)
  values (p_telegram_id, v_today, v_streak, v_reward, v_perk);

  update public.device_coin_wallets
  set balance = balance + v_reward, updated_at = now()
  where id = v_wallet_id
  returning balance into v_balance;

  v_event_key := 'daily-login-coins:' || p_telegram_id || ':' || v_today::text;
  insert into public.device_coin_wallet_transactions
    (wallet_id, telegram_id, event_key, amount, balance_after, reason)
  values
    (v_wallet_id, p_telegram_id, v_event_key, v_reward, v_balance, 'Daily login reward');

  insert into public.leadership_activity_events
    (telegram_id, event_key, event_type, coin_amount, occurred_at, metadata)
  values
    (p_telegram_id, 'daily-login:' || p_telegram_id || ':' || v_today::text,
     'daily_login', 0, now(), jsonb_build_object('streak_day', v_streak)),
    (p_telegram_id, v_event_key,
     'coin_earned', v_reward, now(), jsonb_build_object('source', 'daily_login', 'streak_day', v_streak))
  on conflict (event_key) do nothing;

  return query select true, false, v_reward, v_streak, v_perk, v_today, v_balance;
end;
$$;

revoke all on function public.claim_streetlife_daily_login_device(bigint,text) from public, anon, authenticated;
grant execute on function public.claim_streetlife_daily_login_device(bigint,text) to service_role;
