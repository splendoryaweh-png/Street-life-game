-- STREET LIFE Leadership Board foundation
-- Safe to run more than once. Does not alter player coin balances or existing game tables.

create table if not exists public.leadership_members (
  telegram_id bigint primary key references public.players(telegram_id) on delete cascade,
  is_active boolean not null default true,
  added_by_telegram_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leadership_activity_events (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.players(telegram_id) on delete cascade,
  event_key text not null unique,
  event_type text not null check (
    event_type in ('coin_earned', 'daily_login', 'task_completed', 'game_completed', 'race_completed')
  ),
  coin_amount bigint not null default 0 check (coin_amount >= 0),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint leadership_coin_event_amount check (
    (event_type = 'coin_earned' and coin_amount > 0)
    or (event_type <> 'coin_earned' and coin_amount = 0)
  )
);

create index if not exists leadership_activity_player_type_time_idx
  on public.leadership_activity_events (telegram_id, event_type, occurred_at desc);

create table if not exists public.leadership_admin_adjustments (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.players(telegram_id) on delete cascade,
  action text not null check (action in ('award', 'deduction')),
  amount integer not null check (amount > 0),
  reason text not null check (length(trim(reason)) > 0),
  admin_telegram_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists leadership_admin_adjustments_player_time_idx
  on public.leadership_admin_adjustments (telegram_id, created_at desc);

-- All three tables are server-managed. The service role accesses them from
-- authenticated server routes; ordinary clients receive no direct table access.
alter table public.leadership_members enable row level security;
alter table public.leadership_activity_events enable row level security;
alter table public.leadership_admin_adjustments enable row level security;

revoke all on public.leadership_members from anon, authenticated;
revoke all on public.leadership_activity_events from anon, authenticated;
revoke all on public.leadership_admin_adjustments from anon, authenticated;

grant select, insert, update, delete on public.leadership_members to service_role;
grant select, insert, update, delete on public.leadership_activity_events to service_role;
grant select, insert, update, delete on public.leadership_admin_adjustments to service_role;

-- Admin adjustments are a separate points ledger. A deduction cannot take the
-- admin-adjusted balance below zero. Automatic points and Street Coins are untouched.
create or replace function public.adjust_leadership_points(
  p_telegram_id bigint,
  p_action text,
  p_amount integer,
  p_reason text,
  p_admin_telegram_id text
)
returns table(success boolean, message text, adjusted_balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  if p_action not in ('award', 'deduction') then
    return query select false, 'Invalid adjustment action'::text, 0::bigint;
    return;
  end if;

  if p_amount is null or p_amount <= 0 then
    return query select false, 'Amount must be greater than zero'::text, 0::bigint;
    return;
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    return query select false, 'A reason is required'::text, 0::bigint;
    return;
  end if;

  if p_admin_telegram_id is null or length(trim(p_admin_telegram_id)) = 0 then
    return query select false, 'Administrator identity is required'::text, 0::bigint;
    return;
  end if;

  if not exists (
    select 1 from public.players p where p.telegram_id = p_telegram_id
  ) then
    return query select false, 'Registered player not found'::text, 0::bigint;
    return;
  end if;

  -- Serialize adjustments for the same player to avoid concurrent over-deductions.
  perform pg_advisory_xact_lock(p_telegram_id);

  select coalesce(
    sum(case when a.action = 'award' then a.amount else -a.amount end),
    0
  )
  into v_balance
  from public.leadership_admin_adjustments a
  where a.telegram_id = p_telegram_id;

  if p_action = 'deduction' and v_balance < p_amount then
    return query select false, 'Deduction exceeds the available admin-awarded points'::text, v_balance;
    return;
  end if;

  insert into public.leadership_admin_adjustments (
    telegram_id, action, amount, reason, admin_telegram_id
  ) values (
    p_telegram_id, p_action, p_amount, trim(p_reason), trim(p_admin_telegram_id)
  );

  v_balance := v_balance + case when p_action = 'award' then p_amount else -p_amount end;
  return query select true, 'Leadership points adjusted successfully'::text, v_balance;
end;
$$;

revoke all on function public.adjust_leadership_points(bigint, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.adjust_leadership_points(bigint, text, integer, text, text) to service_role;
