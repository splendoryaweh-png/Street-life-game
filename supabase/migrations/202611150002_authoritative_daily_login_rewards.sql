-- Authoritative, once-per-day Street Life login coin rewards.
-- Dates and streaks use Africa/Lagos, matching the game's primary audience.

begin;

create table if not exists public.daily_login_claims (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.players(telegram_id) on delete cascade,
  claim_date date not null,
  streak_day integer not null check (streak_day between 1 and 7),
  reward_sc integer not null check (reward_sc > 0),
  perk text not null,
  created_at timestamptz not null default now(),
  constraint daily_login_claims_telegram_date_key unique (telegram_id, claim_date)
);

create index if not exists daily_login_claims_telegram_date_idx
  on public.daily_login_claims (telegram_id, claim_date desc);

alter table public.daily_login_claims enable row level security;

create or replace function public.claim_streetlife_daily_login(
  p_telegram_id bigint
)
returns table(
  success boolean,
  message text,
  claim_date date,
  streak_day integer,
  reward_sc integer,
  perk text,
  balance bigint
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_player public.players%rowtype;
  v_today date;
  v_yesterday date;
  v_last_date date;
  v_streak integer;
  v_reward integer;
  v_perk text;
  v_jackpot_bonus integer;
begin
  v_today := (now() at time zone 'Africa/Lagos')::date;
  v_yesterday := v_today - 1;

  select *
    into v_player
  from public.players
  where telegram_id = p_telegram_id
  for update;

  if not found then
    return query select false, 'Player account not found', v_today, 0, 0, '', 0::bigint;
    return;
  end if;

  if exists (
    select 1 from public.daily_login_claims
    where telegram_id = p_telegram_id and claim_date = v_today
  ) then
    return query
      select false, 'Daily login reward already claimed', c.claim_date,
             c.streak_day, c.reward_sc, c.perk, v_player.coins
      from public.daily_login_claims c
      where c.telegram_id = p_telegram_id and c.claim_date = v_today;
    return;
  end if;

  select max(c.claim_date)
    into v_last_date
  from public.daily_login_claims c
  where c.telegram_id = p_telegram_id;

  if v_last_date = v_yesterday then
    select c.streak_day into v_streak
    from public.daily_login_claims c
    where c.telegram_id = p_telegram_id and c.claim_date = v_last_date;
    v_streak := case when v_streak >= 7 then 1 else v_streak + 1 end;
  else
    v_streak := 1;
  end if;

  case v_streak
    when 1 then v_reward := 100; v_perk := '+1 Free Nitro';
    when 2 then v_reward := 200; v_perk := '+2 Free Coin Packs';
    when 3 then v_reward := 300; v_perk := '+1 Shooter Power-up';
    when 4 then v_reward := 400; v_perk := '+3 Free Nitro';
    when 5 then v_reward := 500; v_perk := '+5 Slot Free Spins';
    when 6 then v_reward := 600; v_perk := '+1 Shield Power-up';
    when 7 then
      v_jackpot_bonus := 500 + floor(random() * 1501)::integer;
      v_reward := 1000 + v_jackpot_bonus;
      v_perk := 'Jackpot Box (500-2000 SC)';
  end case;

  insert into public.daily_login_claims
    (telegram_id, claim_date, streak_day, reward_sc, perk)
  values
    (p_telegram_id, v_today, v_streak, v_reward, v_perk);

  update public.players
  set coins = coalesce(coins, 0) + v_reward,
      updated_at = now()
  where telegram_id = p_telegram_id
  returning coins into v_player.coins;

  return query
    select true, 'Daily login reward claimed', v_today,
           v_streak, v_reward, v_perk, v_player.coins;
end;
$function$;

revoke all on function public.claim_streetlife_daily_login(bigint) from public;
revoke all on function public.claim_streetlife_daily_login(bigint) from anon;
revoke all on function public.claim_streetlife_daily_login(bigint) from authenticated;
grant execute on function public.claim_streetlife_daily_login(bigint) to service_role;

commit;
