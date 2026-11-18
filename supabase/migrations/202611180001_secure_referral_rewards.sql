-- Secure, one-time Telegram referral rewards.
-- Referral bonuses are credited to the existing players coin balance in the same
-- transaction as the unique invite claim, so retries cannot double-pay either user.

alter table public.players
  add column if not exists referral_code text;

create unique index if not exists players_referral_code_unique_idx
  on public.players (upper(referral_code))
  where referral_code is not null;

create table if not exists public.streetlife_referral_claims (
  invitee_telegram_id bigint primary key references public.players(telegram_id) on delete cascade,
  inviter_telegram_id bigint not null references public.players(telegram_id) on delete cascade,
  referral_code text not null,
  invitee_reward integer not null default 520 check (invitee_reward >= 0),
  inviter_reward integer not null default 100 check (inviter_reward >= 0),
  created_at timestamptz not null default now(),
  constraint streetlife_referral_no_self_referral
    check (invitee_telegram_id <> inviter_telegram_id)
);

create index if not exists streetlife_referral_claims_inviter_idx
  on public.streetlife_referral_claims (inviter_telegram_id, created_at desc);

alter table public.streetlife_referral_claims enable row level security;
revoke all on public.streetlife_referral_claims from anon, authenticated;
grant select, insert, update, delete on public.streetlife_referral_claims to service_role;

create or replace function public.ensure_streetlife_referral_code(p_telegram_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if p_telegram_id is null or p_telegram_id <= 0 then
    raise exception 'Invalid Telegram player ID';
  end if;

  perform 1 from public.players where telegram_id = p_telegram_id for update;
  if not found then
    raise exception 'Registered player not found';
  end if;

  select referral_code into v_code
  from public.players
  where telegram_id = p_telegram_id;

  if v_code is not null and length(trim(v_code)) > 0 then
    return upper(v_code);
  end if;

  loop
    v_code := 'SL' || upper(substr(md5(random()::text || clock_timestamp()::text || p_telegram_id::text), 1, 8));
    begin
      update public.players
      set referral_code = v_code,
          updated_at = now()
      where telegram_id = p_telegram_id
        and referral_code is null;
      exit;
    exception when unique_violation then
      -- Generate another code if the extremely unlikely collision occurs.
      continue;
    end;
  end loop;

  select upper(referral_code) into v_code
  from public.players
  where telegram_id = p_telegram_id;

  return v_code;
end;
$$;

create or replace function public.claim_streetlife_referral(
  p_invitee_telegram_id bigint,
  p_referral_code text
)
returns table(
  success boolean,
  message text,
  invitee_reward integer,
  inviter_reward integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter_id bigint;
  v_code text := upper(trim(coalesce(p_referral_code, '')));
  v_existing public.streetlife_referral_claims%rowtype;
  v_invitee_reward integer := 520;
  v_inviter_reward integer := 100;
begin
  if p_invitee_telegram_id is null or p_invitee_telegram_id <= 0 then
    return query select false, 'Invalid Telegram player ID'::text, 0, 0;
    return;
  end if;

  if v_code = '' or length(v_code) > 32 then
    return query select false, 'Enter a valid referral code.'::text, 0, 0;
    return;
  end if;

  select p.telegram_id into v_inviter_id
  from public.players p
  where upper(p.referral_code) = v_code
  limit 1;

  if v_inviter_id is null then
    return query select false, 'Referral code was not found.'::text, 0, 0;
    return;
  end if;

  if v_inviter_id = p_invitee_telegram_id then
    return query select false, 'You cannot use your own referral code.'::text, 0, 0;
    return;
  end if;

  -- Consistent lock ordering prevents deadlocks when two users claim at once.
  perform pg_advisory_xact_lock(least(v_inviter_id, p_invitee_telegram_id));
  perform pg_advisory_xact_lock(greatest(v_inviter_id, p_invitee_telegram_id));

  if not exists (select 1 from public.players where telegram_id = p_invitee_telegram_id) then
    return query select false, 'Player account was not found.'::text, 0, 0;
    return;
  end if;

  select * into v_existing
  from public.streetlife_referral_claims
  where invitee_telegram_id = p_invitee_telegram_id;

  if found then
    return query select false, 'You have already claimed a referral welcome bonus.'::text, 0, 0;
    return;
  end if;

  -- Revalidate the inviter after taking locks.
  if not exists (
    select 1 from public.players
    where telegram_id = v_inviter_id and upper(referral_code) = v_code
  ) then
    return query select false, 'Referral code is no longer valid.'::text, 0, 0;
    return;
  end if;

  insert into public.streetlife_referral_claims (
    invitee_telegram_id, inviter_telegram_id, referral_code,
    invitee_reward, inviter_reward
  ) values (
    p_invitee_telegram_id, v_inviter_id, v_code,
    v_invitee_reward, v_inviter_reward
  );

  update public.players
  set coins = coalesce(coins, 0) + v_invitee_reward,
      updated_at = now()
  where telegram_id = p_invitee_telegram_id;

  update public.players
  set coins = coalesce(coins, 0) + v_inviter_reward,
      updated_at = now()
  where telegram_id = v_inviter_id;

  -- Feed the existing server-side Leadership activity ledger.
  insert into public.leadership_activity_events
    (telegram_id, event_key, event_type, coin_amount, occurred_at, metadata)
  values
    (p_invitee_telegram_id,
     'referral-welcome:' || p_invitee_telegram_id::text,
     'coin_earned', v_invitee_reward, now(),
     jsonb_build_object('source', 'referral_welcome', 'inviter_telegram_id', v_inviter_id)),
    (v_inviter_id,
     'referral-invite:' || p_invitee_telegram_id::text,
     'coin_earned', v_inviter_reward, now(),
     jsonb_build_object('source', 'referral_invite', 'invitee_telegram_id', p_invitee_telegram_id))
  on conflict (event_key) do nothing;

  return query select true, 'Referral successful! +520 coins for you and +100 coins for your inviter.'::text,
    v_invitee_reward, v_inviter_reward;
end;
$$;

revoke all on function public.ensure_streetlife_referral_code(bigint) from public, anon, authenticated;
grant execute on function public.ensure_streetlife_referral_code(bigint) to service_role;
revoke all on function public.claim_streetlife_referral(bigint, text) from public, anon, authenticated;
grant execute on function public.claim_streetlife_referral(bigint, text) to service_role;
