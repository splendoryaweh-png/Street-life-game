-- Move daily-login rewards directly into the device-scoped wallet.
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

  if found and v_existing.telegram_id is not null then
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
    else v_reward := 1000 + 500 + floor(random() * 1501)::integer;
      v_perk := 'Jackpot Box (500-2000 SC)';
  end case;

  insert into public.daily_login_claims (telegram_id, claim_date, streak_day, reward_sc, perk)
  values (p_telegram_id, v_today, v_streak, v_reward, v_perk);

  v_event_key := 'daily-login-coins:' || p_telegram_id || ':' || v_today::text;
  update public.device_coin_wallets
  set balance = balance + v_reward, updated_at = now()
  where id = v_wallet_id
  returning balance into v_balance;

  insert into public.device_coin_wallet_transactions
    (wallet_id, telegram_id, event_key, amount, balance_after, reason)
  values
    (v_wallet_id, p_telegram_id, v_event_key, v_reward, v_balance, 'Daily login reward');

  insert into public.leadership_activity_events
    (telegram_id, event_key, event_type, coin_amount, occurred_at, metadata)
  values
    (p_telegram_id, 'daily-login:' || p_telegram_id || ':' || v_today::text,
     'daily_login', 0, now(), jsonb_build_object('streak_day', v_streak)),
    (p_telegram_id, 'daily-login-coins:' || p_telegram_id || ':' || v_today::text,
     'coin_earned', v_reward, now(), jsonb_build_object('source', 'daily_login', 'streak_day', v_streak))
  on conflict (event_key) do nothing;

  return query select true, false, v_reward, v_streak, v_perk, v_today, v_balance;
end;
$$;

revoke all on function public.claim_streetlife_daily_login_device(bigint,text) from public,anon,authenticated;
grant execute on function public.claim_streetlife_daily_login_device(bigint,text) to service_role;
