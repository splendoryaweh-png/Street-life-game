-- STREET LIFE referral repair.
-- Backfills missing player codes without replacing existing codes, then makes
-- codes unique regardless of letter case. Referral claims are server-only.
create extension if not exists pgcrypto;

do $$
declare
  r record;
  v_code text;
begin
  for r in
    select p.telegram_id
    from public.players p
    where p.referral_code is null or length(trim(p.referral_code)) = 0
    order by p.telegram_id
  loop
    loop
      v_code := 'SL' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 7));
      exit when not exists (
        select 1 from public.players p
        where upper(trim(coalesce(p.referral_code, ''))) = v_code
      );
    end loop;

    update public.players
    set referral_code = v_code,
        updated_at = now()
    where telegram_id = r.telegram_id
      and (referral_code is null or length(trim(referral_code)) = 0);
  end loop;
end;
$$;

create unique index if not exists players_referral_code_upper_uidx
  on public.players (upper(trim(referral_code)))
  where referral_code is not null and length(trim(referral_code)) > 0;

create or replace function public.claim_streetlife_referral(
  p_invitee_telegram_id bigint,
  p_inviter_code text
)
returns table(success boolean, message text, invitee_bonus bigint, inviter_bonus bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter_id bigint;
  v_code text;
begin
  if p_invitee_telegram_id is null or p_invitee_telegram_id <= 0 then
    raise exception 'Invalid invited player';
  end if;
  v_code := upper(trim(coalesce(p_inviter_code, '')));
  if v_code = '' then
    return query select false, 'Please enter a referral code.'::text, 0::bigint, 0::bigint;
    return;
  end if;

  -- Serialize claims for this invitee to prevent duplicate rewards.
  perform pg_advisory_xact_lock(p_invitee_telegram_id);

  select p.telegram_id into v_inviter_id
  from public.players p
  where upper(trim(p.referral_code)) = v_code
  limit 1;

  if v_inviter_id is null then
    return query select false, 'Referral code not found. Check the code with your inviter.'::text, 0::bigint, 0::bigint;
    return;
  end if;

  if v_inviter_id = p_invitee_telegram_id then
    return query select false, 'You cannot use your own referral code.'::text, 0::bigint, 0::bigint;
    return;
  end if;

  if not exists (
    select 1 from public.players p where p.telegram_id = p_invitee_telegram_id
  ) then
    return query select false, 'Your player account is not registered yet. Reopen the game and try again.'::text, 0::bigint, 0::bigint;
    return;
  end if;

  -- Lock both accounts in a stable order before updating their balances.
  perform 1
  from public.players p
  where p.telegram_id in (p_invitee_telegram_id, v_inviter_id)
  order by p.telegram_id
  for update;

  if exists (
    select 1 from public.players p
    where p.telegram_id = p_invitee_telegram_id
      and (coalesce(p.referred_by, '') <> '' or coalesce(p.referred_by_code, '') <> '')
  ) then
    return query select false, 'A referral has already been claimed on this account.'::text, 0::bigint, 0::bigint;
    return;
  end if;

  update public.players
  set coins = coalesce(coins, 0) + 520,
      referred_by = v_inviter_id::text,
      referred_by_code = v_code,
      updated_at = now()
  where telegram_id = p_invitee_telegram_id;

  update public.players
  set coins = coalesce(coins, 0) + 100,
      updated_at = now()
  where telegram_id = v_inviter_id;

  return query select true, 'Referral accepted! 520 Street Coins added to your account; your inviter received 100.'::text, 520::bigint, 100::bigint;
end;
$$;

revoke all on function public.claim_streetlife_referral(bigint, text) from public, anon, authenticated;
grant execute on function public.claim_streetlife_referral(bigint, text) to service_role;
