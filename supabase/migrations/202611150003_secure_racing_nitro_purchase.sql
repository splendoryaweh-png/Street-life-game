-- Charge Street Coins on the server before granting a racing Nitro item.
begin;

create or replace function public.purchase_streetlife_racing_nitro(
  p_telegram_id bigint
)
returns table(success boolean, message text, balance bigint, cost integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_balance bigint;
begin
  select p.coins into v_balance
  from public.players p
  where p.telegram_id = p_telegram_id
  for update;

  if not found then
    return query select false, 'Player account not found', 0::bigint, 50;
    return;
  end if;

  update public.players p
  set coins = p.coins - 50,
      updated_at = now()
  where p.telegram_id = p_telegram_id
    and p.coins >= 50
  returning p.coins into v_balance;

  if not found then
    select p.coins into v_balance
    from public.players p
    where p.telegram_id = p_telegram_id;
    return query select false, 'Insufficient Street Coins', coalesce(v_balance, 0), 50;
    return;
  end if;

  return query select true, 'Racing Nitro purchased', v_balance, 50;
end;
$function$;

revoke all on function public.purchase_streetlife_racing_nitro(bigint) from public;
revoke all on function public.purchase_streetlife_racing_nitro(bigint) from anon;
revoke all on function public.purchase_streetlife_racing_nitro(bigint) from authenticated;
grant execute on function public.purchase_streetlife_racing_nitro(bigint) to service_role;

commit;
