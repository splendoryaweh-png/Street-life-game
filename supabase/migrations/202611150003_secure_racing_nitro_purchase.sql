-- Idempotent, atomic Street Coin charge for racing Nitro purchases.
begin;

create table if not exists public.racing_nitro_purchases (
  id uuid primary key,
  telegram_id bigint not null references public.players(telegram_id) on delete cascade,
  cost integer not null check (cost = 50),
  success boolean not null,
  balance_after bigint not null,
  created_at timestamptz not null default now()
);

alter table public.racing_nitro_purchases enable row level security;

create or replace function public.purchase_streetlife_racing_nitro(
  p_telegram_id bigint,
  p_request_id uuid
)
returns table(success boolean, message text, balance bigint, cost integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_balance bigint;
  v_existing public.racing_nitro_purchases%rowtype;
begin
  if p_request_id is null then
    return query select false, 'Purchase request ID is required', 0::bigint, 50;
    return;
  end if;

  select p.coins into v_balance
  from public.players p
  where p.telegram_id = p_telegram_id
  for update;

  if not found then
    return query select false, 'Player account not found', 0::bigint, 50;
    return;
  end if;

  -- Player row lock serializes retries for this account before idempotency lookup.
  select * into v_existing
  from public.racing_nitro_purchases p
  where p.id = p_request_id and p.telegram_id = p_telegram_id;

  if found then
    return query
      select v_existing.success,
        case when v_existing.success then 'Racing Nitro purchased' else 'Insufficient Street Coins' end,
        v_existing.balance_after, v_existing.cost;
    return;
  end if;

  update public.players p
  set coins = p.coins - 50,
      updated_at = now()
  where p.telegram_id = p_telegram_id
    and p.coins >= 50
  returning p.coins into v_balance;

  if not found then
    select p.coins into v_balance
    from public.players p
    where p.telegram_id = p_telegram_id;

    insert into public.racing_nitro_purchases(id, telegram_id, cost, success, balance_after)
    values (p_request_id, p_telegram_id, 50, false, coalesce(v_balance, 0));

    return query select false, 'Insufficient Street Coins', coalesce(v_balance, 0), 50;
    return;
  end if;

  insert into public.racing_nitro_purchases(id, telegram_id, cost, success, balance_after)
  values (p_request_id, p_telegram_id, 50, true, v_balance);

  return query select true, 'Racing Nitro purchased', v_balance, 50;
end;
$function$;

revoke all on function public.purchase_streetlife_racing_nitro(bigint, uuid) from public;
revoke all on function public.purchase_streetlife_racing_nitro(bigint, uuid) from anon;
revoke all on function public.purchase_streetlife_racing_nitro(bigint, uuid) from authenticated;
grant execute on function public.purchase_streetlife_racing_nitro(bigint, uuid) to service_role;

commit;
