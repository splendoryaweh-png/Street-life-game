-- Referral rewards are routed to the exact device wallets involved.
create extension if not exists pgcrypto;

create table if not exists public.device_referral_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  inviter_telegram_id bigint not null references public.players(telegram_id),
  inviter_wallet_id uuid not null references public.device_coin_wallets(id),
  referral_code text not null,
  created_at timestamptz not null default now(),
  active boolean not null default true
);
create table if not exists public.device_referral_claims (
  invitee_telegram_id bigint primary key references public.players(telegram_id),
  link_id uuid not null references public.device_referral_links(id),
  invitee_wallet_id uuid not null references public.device_coin_wallets(id),
  inviter_wallet_id uuid not null references public.device_coin_wallets(id),
  created_at timestamptz not null default now()
);
alter table public.device_referral_links enable row level security;
alter table public.device_referral_claims enable row level security;
revoke all on public.device_referral_links, public.device_referral_claims from anon, authenticated;
grant select,insert,update,delete on public.device_referral_links, public.device_referral_claims to service_role;

create or replace function public.create_device_referral_link(
 p_telegram_id bigint, p_device_key_hash text, p_token_hash text
) returns table(referral_code text)
language plpgsql security definer set search_path=public as $$
declare v_wallet uuid; v_code text;
begin
 select wallet_id into v_wallet from public.get_or_create_device_coin_wallet(p_telegram_id,p_device_key_hash);
 select p.referral_code into v_code from public.players p where p.telegram_id=p_telegram_id;
 if v_code is null or trim(v_code)='' then raise exception 'Referral code missing'; end if;
 insert into public.device_referral_links(token_hash,inviter_telegram_id,inviter_wallet_id,referral_code)
 values(p_token_hash,p_telegram_id,v_wallet,v_code);
 return query select v_code;
end $$;

create or replace function public.claim_device_referral(
 p_invitee_telegram_id bigint,
 p_invitee_device_key_hash text,
 p_token_hash text
) returns table(success boolean,message text,invitee_bonus bigint,inviter_bonus bigint,invitee_balance bigint,referrals_count bigint)
language plpgsql security definer set search_path=public as $$
declare
 v_link public.device_referral_links%rowtype;
 v_invitee_wallet uuid;
 v_invitee_balance bigint;
 v_inviter_balance bigint;
 v_count bigint;
begin
 perform pg_advisory_xact_lock(p_invitee_telegram_id);
 select * into v_link from public.device_referral_links where token_hash=p_token_hash and active=true;
 if not found then return query select false,'Referral link is invalid or expired.'::text,0::bigint,0::bigint,0::bigint,0::bigint; return; end if;
 if v_link.inviter_telegram_id=p_invitee_telegram_id then
  return query select false,'You cannot use your own referral link.'::text,0::bigint,0::bigint,0::bigint,0::bigint; return;
 end if;
 if exists(select 1 from public.device_referral_claims where invitee_telegram_id=p_invitee_telegram_id) then
  return query select false,'A referral has already been claimed on this account.'::text,0::bigint,0::bigint,0::bigint,0::bigint; return;
 end if;
 if not exists(select 1 from public.players where telegram_id=p_invitee_telegram_id) then
  return query select false,'Player account is not registered.'::text,0::bigint,0::bigint,0::bigint,0::bigint; return;
 end if;
 select wallet_id,balance into v_invitee_wallet,v_invitee_balance
 from public.get_or_create_device_coin_wallet(p_invitee_telegram_id,p_invitee_device_key_hash);
 perform 1 from public.device_coin_wallets where id in(v_invitee_wallet,v_link.inviter_wallet_id) order by id for update;
 update public.device_coin_wallets set balance=balance+520,updated_at=now()
 where id=v_invitee_wallet returning balance into v_invitee_balance;
 update public.device_coin_wallets set balance=balance+100,updated_at=now()
 where id=v_link.inviter_wallet_id returning balance into v_inviter_balance;
 insert into public.device_coin_wallet_transactions(wallet_id,telegram_id,event_key,amount,balance_after,reason)
 values
 (v_invitee_wallet,p_invitee_telegram_id,'referral-invitee:'||p_invitee_telegram_id,520,v_invitee_balance,'Referral welcome bonus'),
 (v_link.inviter_wallet_id,v_link.inviter_telegram_id,'referral-inviter:'||p_invitee_telegram_id,100,v_inviter_balance,'Successful referral reward');
 insert into public.device_referral_claims(invitee_telegram_id,link_id,invitee_wallet_id,inviter_wallet_id)
 values(p_invitee_telegram_id,v_link.id,v_invitee_wallet,v_link.inviter_wallet_id);
 update public.players set referred_by=v_link.inviter_telegram_id::text,referred_by_code=v_link.referral_code,updated_at=now()
 where telegram_id=p_invitee_telegram_id;
 select count(*) into v_count from public.device_referral_claims c join public.device_referral_links l on l.id=c.link_id
 where l.inviter_telegram_id=v_link.inviter_telegram_id;
 return query select true,'Referral accepted! 520 coins added to your phone wallet; your inviter received 100 on the phone that created this link.'::text,520::bigint,100::bigint,v_invitee_balance,v_count;
end $$;
revoke all on function public.create_device_referral_link(bigint,text,text) from public,anon,authenticated;
revoke all on function public.claim_device_referral(bigint,text,text) from public,anon,authenticated;
grant execute on function public.create_device_referral_link(bigint,text,text) to service_role;
grant execute on function public.claim_device_referral(bigint,text,text) to service_role;
