-- Credit daily-login Street Coins to the registered account balance in the same
-- transaction as the unique daily claim and Leadership events.
-- Keeps the existing RPC signature so the already-installed API remains compatible.

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

  perform pg_advisory_xact_lock(p_telegram_id);

  select * into v_existing
  from public.daily_login_claims d
  where d.telegram_id = p_telegram_id and d.claim_date = v_today;

  if found then
    return query select true, true, v_existing.reward_sc, v_existing.streak_day,
      v_existing.perk, v_today;
    return;
  end if;

  if not exists (select 1 from public.players p where p.telegram_id = p_telegram_id) then
    raise exception 'Registered player not found';
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
    else v_reward := 1000 + 500 + floor(random() * 1501)::integer;
      v_perk := 'Jackpot Box (500-2000 SC)';
  end case;

  insert into public.daily_login_claims (telegram_id, claim_date, streak_day, reward_sc, perk)
  values (p_telegram_id, v_today, v_streak, v_reward, v_perk);

  -- This is the authoritative wallet credit. It runs once because the claim
  -- row is unique and the advisory lock serializes simultaneous requests.
  update public.players
  set coins = coalesce(coins, 0) + v_reward,
      updated_at = now()
  where telegram_id = p_telegram_id;

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
