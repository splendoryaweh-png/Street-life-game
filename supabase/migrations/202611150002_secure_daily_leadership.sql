-- Secure daily-login reward recording for the Leadership Board.
-- Daily claims are keyed by Telegram account and Africa/Lagos calendar date.
-- Remove duplicate legacy rows before enforcing one claim per account per date.
with ranked as (
  select id, row_number() over (
    partition by telegram_id, claim_date order by created_at asc, id asc
  ) as row_num
  from public.daily_login_claims
)
delete from public.daily_login_claims d
using ranked r
where d.id = r.id and r.row_num > 1;

create unique index if not exists daily_login_claims_telegram_date_uidx
  on public.daily_login_claims (telegram_id, claim_date);

drop function if exists public.claim_streetlife_daily_login(bigint);

create or replace function public.claim_streetlife_daily_login(p_telegram_id bigint)
returns table(success boolean, already_claimed boolean, reward_sc integer, streak_day integer, perk text, claim_date date)
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
begin
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'Invalid Telegram player ID';
  end if;

  if not exists (select 1 from public.players p where p.telegram_id = p_telegram_id) then
    raise exception 'Registered player not found';
  end if;

  perform pg_advisory_xact_lock(p_telegram_id);

  select * into v_existing
  from public.daily_login_claims d
  where d.telegram_id = p_telegram_id and d.claim_date = v_today;

  if found then
    return query select true, true, v_existing.reward_sc, v_existing.streak_day,
      v_existing.perk, v_today;
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
    else v_reward := 1000 + 500 + floor(random() * 1500)::integer;
      v_perk := 'Jackpot Box (500-2000 SC)';
  end case;

  insert into public.daily_login_claims (telegram_id, claim_date, streak_day, reward_sc, perk)
  values (p_telegram_id, v_today, v_streak, v_reward, v_perk);

  insert into public.leadership_activity_events
    (telegram_id, event_key, event_type, coin_amount, occurred_at, metadata)
  values
    (p_telegram_id, 'daily-login:' || p_telegram_id || ':' || v_today::text,
     'daily_login', 0, now(), jsonb_build_object('streak_day', v_streak)),
    (p_telegram_id, 'daily-login-coins:' || p_telegram_id || ':' || v_today::text,
     'coin_earned', v_reward, now(), jsonb_build_object('source', 'daily_login', 'streak_day', v_streak))
  on conflict (event_key) do nothing;

  return query select true, false, v_reward, v_streak, v_perk, v_today;
end;
$$;

revoke all on function public.claim_streetlife_daily_login(bigint) from public, anon, authenticated;
grant execute on function public.claim_streetlife_daily_login(bigint) to service_role;


-- Mirror task reward ledger inserts into Leadership in the same DB transaction.
-- This is the authoritative path; the API helper is a safe retry/fallback.
create or replace function public.track_task_coin_transaction_for_leadership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_telegram_id bigint;
  v_submission_key text;
begin
  if new.amount is null or new.amount <= 0 then
    return new;
  end if;

  if new.player_telegram_id !~ '^[0-9]+$' then
    raise warning 'Skipping Leadership task tracking for non-numeric Telegram ID';
    return new;
  end if;

  v_telegram_id := new.player_telegram_id::bigint;
  v_submission_key := coalesce(new.submission_id::text, new.id::text);

  insert into public.leadership_activity_events
    (telegram_id, event_key, event_type, coin_amount, occurred_at, metadata)
  values
    (v_telegram_id, 'task-completed:' || v_submission_key,
     'task_completed', 0, coalesce(new.created_at, now()),
     jsonb_build_object('source', 'task_coin_transactions', 'submission_id', new.submission_id)),
    (v_telegram_id, 'task-coin-earned:' || v_submission_key,
     'coin_earned', new.amount, coalesce(new.created_at, now()),
     jsonb_build_object('source', 'approved_task', 'submission_id', new.submission_id))
  on conflict (event_key) do nothing;

  return new;
end;
$$;

drop trigger if exists task_coin_transactions_leadership_after_insert
  on public.task_coin_transactions;

create trigger task_coin_transactions_leadership_after_insert
after insert on public.task_coin_transactions
for each row execute function public.track_task_coin_transaction_for_leadership();

revoke all on function public.track_task_coin_transaction_for_leadership() from public, anon, authenticated;
