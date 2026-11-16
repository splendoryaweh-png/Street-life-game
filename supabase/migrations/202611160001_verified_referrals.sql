-- Verified, one-time STREET LIFE referral rewards.
-- Existing coin balances are incremented, never reset.
create unique index if not exists players_referral_code_unique
  on public.players (upper(referral_code))
  where referral_code is not null and length(trim(referral_code)) > 0;

create table if not exists public.streetlife_referral_claims (
  invitee_telegram_id bigint primary key references public.players(telegram_id) on delete cascade,
  inviter_telegram_id bigint not null references public.players(telegram_id) on delete cascade,
  referral_code text not null,
  invitee_reward bigint not null default 520,
  inviter_reward bigint not null default 100,
  claimed_at timestamptz not null default now(),
  constraint streetlife_referral_no_self check (invitee_telegram_id <> inviter_telegram_id)
);
alter table public.streetlife_referral_claims enable row level security;
revoke all on public.streetlife_referral_claims from anon, authenticated;
grant select, insert, update, delete on public.streetlife_referral_claims to service_role;

create or replace function public.ensure_streetlife_referral_code(p_telegram_id bigint)
returns text
language plpgsql security definer set search_path=public
as $$
declare v_code text; v_attempt integer := 0;
begin
  if p_telegram_id is null or p_telegram_id <= 0 then raise exception 'Invalid Telegram player ID'; end if;
  perform pg_advisory_xact_lock(p_telegram_id);
  select referral_code into v_code from public.players where telegram_id=p_telegram_id for update;
  if not found then raise exception 'Registered player not found'; end if;
  if v_code is not null and length(trim(v_code)) > 0 then return upper(v_code); end if;
  loop
    v_code := 'SL' || upper(substr(md5(random()::text || clock_timestamp()::text || p_telegram_id::text),1,6));
    begin
      update public.players set referral_code=v_code, updated_at=now() where telegram_id=p_telegram_id;
      return v_code;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt >= 10 then raise exception 'Could not create a unique referral code'; end if;
    end;
  end loop;
end;
$$;

create or replace function public.claim_streetlife_referral(
  p_invitee_telegram_id bigint,
  p_referral_code text
)
returns table(success boolean, message text, invitee_reward bigint, inviter_reward bigint)
language plpgsql security definer set search_path=public
as $$
declare v_inviter_id bigint; v_existing bigint;
begin
  if p_invitee_telegram_id is null or p_invitee_telegram_id <= 0 then
    return query select false, 'Invalid player account'::text, 0::bigint, 0::bigint; return;
  end if;
  if p_referral_code is null or length(trim(p_referral_code)) < 4 then
    return query select false, 'Enter a valid referral code'::text, 0::bigint, 0::bigint; return;
  end if;
  perform pg_advisory_xact_lock(p_invitee_telegram_id);
  select inviter_telegram_id into v_existing from public.streetlife_referral_claims
    where invitee_telegram_id=p_invitee_telegram_id;
  if found then
    return query select false, 'This account has already claimed a referral reward'::text, 0::bigint, 0::bigint; return;
  end if;
  select telegram_id into v_inviter_id from public.players
    where upper(referral_code)=upper(trim(p_referral_code)) for update;
  if v_inviter_id is null then
    return query select false, 'Referral code not found'::text, 0::bigint, 0::bigint; return;
  end if;
  if v_inviter_id=p_invitee_telegram_id then
    return query select false, 'You cannot use your own referral code'::text, 0::bigint, 0::bigint; return;
  end if;
  if not exists(select 1 from public.players where telegram_id=p_invitee_telegram_id for update) then
    return query select false, 'Register your player account first'::text, 0::bigint, 0::bigint; return;
  end if;
  insert into public.streetlife_referral_claims(invitee_telegram_id,inviter_telegram_id,referral_code)
    values(p_invitee_telegram_id,v_inviter_id,upper(trim(p_referral_code)));
  update public.players set coins=coalesce(coins,0)+520, referred_by_code=upper(trim(p_referral_code)), updated_at=now()
    where telegram_id=p_invitee_telegram_id;
  update public.players set coins=coalesce(coins,0)+100, updated_at=now()
    where telegram_id=v_inviter_id;
  return query select true, 'Referral claimed: +520 SC for you and +100 SC for your inviter'::text, 520::bigint, 100::bigint;
end;
$$;
revoke all on function public.ensure_streetlife_referral_code(bigint) from public, anon, authenticated;
revoke all on function public.claim_streetlife_referral(bigint,text) from public, anon, authenticated;
grant execute on function public.ensure_streetlife_referral_code(bigint) to service_role;
grant execute on function public.claim_streetlife_referral(bigint,text) to service_role;
