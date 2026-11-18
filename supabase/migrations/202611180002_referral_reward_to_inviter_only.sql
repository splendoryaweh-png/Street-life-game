-- Referral reward policy: inviter receives 520 coins; invitee receives no extra
-- referral coins because every new player already starts with 1,000 coins.
create or replace function public.claim_streetlife_referral(
  p_invitee_telegram_id bigint,
  p_referral_code text
)
returns table(success boolean, message text, invitee_reward integer, inviter_reward integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter_id bigint;
  v_code text := upper(trim(coalesce(p_referral_code, '')));
  v_existing public.streetlife_referral_claims%rowtype;
  v_invitee_reward integer := 0;
  v_inviter_reward integer := 520;
begin
  if p_invitee_telegram_id is null or p_invitee_telegram_id <= 0 then
    return query select false, 'Invalid Telegram player ID'::text, 0, 0; return;
  end if;
  if v_code = '' or length(v_code) > 32 then
    return query select false, 'Enter a valid referral code.'::text, 0, 0; return;
  end if;

  select p.telegram_id into v_inviter_id from public.players p
  where upper(p.referral_code) = v_code limit 1;
  if v_inviter_id is null then
    return query select false, 'Referral code was not found.'::text, 0, 0; return;
  end if;
  if v_inviter_id = p_invitee_telegram_id then
    return query select false, 'You cannot use your own referral code.'::text, 0, 0; return;
  end if;

  perform pg_advisory_xact_lock(least(v_inviter_id, p_invitee_telegram_id));
  perform pg_advisory_xact_lock(greatest(v_inviter_id, p_invitee_telegram_id));

  if not exists (select 1 from public.players where telegram_id = p_invitee_telegram_id) then
    return query select false, 'Player account was not found.'::text, 0, 0; return;
  end if;

  select * into v_existing from public.streetlife_referral_claims
  where invitee_telegram_id = p_invitee_telegram_id;
  if found then
    return query select false, 'You have already claimed a referral.'::text, 0, 0; return;
  end if;

  if not exists (select 1 from public.players
    where telegram_id = v_inviter_id and upper(referral_code) = v_code) then
    return query select false, 'Referral code is no longer valid.'::text, 0, 0; return;
  end if;

  insert into public.streetlife_referral_claims (
    invitee_telegram_id, inviter_telegram_id, referral_code, invitee_reward, inviter_reward
  ) values (p_invitee_telegram_id, v_inviter_id, v_code, v_invitee_reward, v_inviter_reward);

  -- Do not add coins to the invitee: their starting balance is already 1,000.
  update public.players set coins = coalesce(coins, 0) + v_inviter_reward, updated_at = now()
  where telegram_id = v_inviter_id;

  insert into public.leadership_activity_events
    (telegram_id, event_key, event_type, coin_amount, occurred_at, metadata)
  values (v_inviter_id, 'referral-invite:' || p_invitee_telegram_id::text,
    'coin_earned', v_inviter_reward, now(),
    jsonb_build_object('source', 'referral_invite', 'invitee_telegram_id', p_invitee_telegram_id))
  on conflict (event_key) do nothing;

  return query select true, 'Referral successful! Your inviter has received +520 coins.'::text,
    v_invitee_reward, v_inviter_reward;
end;
$$;

revoke all on function public.claim_streetlife_referral(bigint, text) from public, anon, authenticated;
grant execute on function public.claim_streetlife_referral(bigint, text) to service_role;
