-- STREET LIFE secure referrals: preserve existing codes and backfill missing ones.
create extension if not exists pgcrypto;

do $$
declare r record; v_code text;
begin
  for r in select telegram_id from public.players
    where referral_code is null or length(trim(referral_code)) = 0
    order by telegram_id
  loop
    loop
      v_code := 'SL' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 7));
      exit when not exists (select 1 from public.players where upper(trim(coalesce(referral_code,''))) = v_code);
    end loop;
    update public.players set referral_code=v_code, updated_at=now()
    where telegram_id=r.telegram_id and (referral_code is null or length(trim(referral_code))=0);
  end loop;
end $$;

create unique index if not exists players_referral_code_upper_uidx
on public.players (upper(trim(referral_code)))
where referral_code is not null and length(trim(referral_code)) > 0;

create or replace function public.claim_streetlife_referral(
  p_invitee_telegram_id bigint,
  p_inviter_code text,
  p_username text default null,
  p_first_name text default null,
  p_last_name text default null,
  p_photo_url text default null
)
returns table(success boolean, message text, invitee_bonus bigint, inviter_bonus bigint, invitee_referral_code text, referrals_count bigint)
language plpgsql security definer set search_path=public
as $$
declare
  v_inviter_id bigint;
  v_code text := upper(trim(coalesce(p_inviter_code,'')));
  v_new_code text;
  v_invitee_code text;
  v_count bigint;
begin
  if p_invitee_telegram_id is null or p_invitee_telegram_id <= 0 then
    raise exception 'Invalid invited player';
  end if;
  if v_code = '' then
    return query select false,'Please enter a referral code.'::text,0::bigint,0::bigint,null::text,0::bigint; return;
  end if;
  perform pg_advisory_xact_lock(p_invitee_telegram_id);

  select telegram_id into v_inviter_id from public.players
    where upper(trim(referral_code))=v_code limit 1;
  if v_inviter_id is null then
    return query select false,'Referral code not found. Check the code with your inviter.'::text,0::bigint,0::bigint,null::text,0::bigint; return;
  end if;
  if v_inviter_id=p_invitee_telegram_id then
    return query select false,'You cannot use your own referral code.'::text,0::bigint,0::bigint,null::text,0::bigint; return;
  end if;

  -- Create/update the verified Telegram player row, so a fresh Mini App launch
  -- can be registered during its first referral claim.
  insert into public.players(telegram_id,username,first_name,last_name,photo_url,coins,created_at,updated_at)
  values(p_invitee_telegram_id,p_username,p_first_name,p_last_name,p_photo_url,0,now(),now())
  on conflict(telegram_id) do update set
    username=coalesce(excluded.username,players.username),
    first_name=coalesce(excluded.first_name,players.first_name),
    last_name=coalesce(excluded.last_name,players.last_name),
    photo_url=coalesce(excluded.photo_url,players.photo_url),
    updated_at=now();

  select referral_code into v_invitee_code from public.players where telegram_id=p_invitee_telegram_id for update;
  if v_invitee_code is null or length(trim(v_invitee_code))=0 then
    loop
      v_new_code := 'SL' || upper(substr(encode(gen_random_bytes(6),'hex'),1,7));
      exit when not exists(select 1 from public.players where upper(trim(coalesce(referral_code,'')))=v_new_code);
    end loop;
    update public.players set referral_code=v_new_code,updated_at=now()
      where telegram_id=p_invitee_telegram_id returning referral_code into v_invitee_code;
  end if;

  perform 1 from public.players where telegram_id in(p_invitee_telegram_id,v_inviter_id) order by telegram_id for update;
  if exists(select 1 from public.players where telegram_id=p_invitee_telegram_id
    and (coalesce(referred_by,'')<>'' or coalesce(referred_by_code,'')<>'')) then
    return query select false,'A referral has already been claimed on this account.'::text,0::bigint,0::bigint,v_invitee_code,0::bigint; return;
  end if;

  update public.players set coins=coalesce(coins,0)+520,referred_by=v_inviter_id::text,
    referred_by_code=v_code,updated_at=now() where telegram_id=p_invitee_telegram_id;
  update public.players set coins=coalesce(coins,0)+100,updated_at=now() where telegram_id=v_inviter_id;
  select count(*) into v_count from public.players where referred_by=v_inviter_id::text;
  return query select true,'Referral accepted! 520 Street Coins added; your inviter received 100.'::text,
    520::bigint,100::bigint,v_invitee_code,v_count;
end $$;

revoke all on function public.claim_streetlife_referral(bigint,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_streetlife_referral(bigint,text,text,text,text,text) to service_role;
