create or replace function public.streetgangstar_join_room(
  p_room_id uuid,
  p_telegram_id bigint,
  p_player_name text,
  p_team text default 'blue'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.streetgangstar_rooms%rowtype;
  v_existing boolean;
  v_count integer;
begin
  select * into v_room from public.streetgangstar_rooms where id = p_room_id for update;
  if not found or v_room.status = 'closed' or v_room.expires_at <= now() then
    return jsonb_build_object('status', 'unavailable');
  end if;
  select exists(select 1 from public.streetgangstar_room_players where room_id = p_room_id and telegram_id = p_telegram_id) into v_existing;
  if v_existing then
    update public.streetgangstar_room_players set last_seen_at = now() where room_id = p_room_id and telegram_id = p_telegram_id;
    return jsonb_build_object('status', 'existing');
  end if;
  select count(*) into v_count from public.streetgangstar_room_players where room_id = p_room_id;
  if v_count >= v_room.max_players then return jsonb_build_object('status', 'full'); end if;
  insert into public.streetgangstar_room_players(room_id, telegram_id, player_name, team, is_host, player_state, last_seen_at)
  values (p_room_id, p_telegram_id, left(coalesce(nullif(trim(p_player_name), ''), 'Street Player'), 24),
    case when p_team = 'red' then 'red' else 'blue' end, false, '{}'::jsonb, now());
  return jsonb_build_object('status', 'joined');
end;
$$;
revoke all on function public.streetgangstar_join_room(uuid, bigint, text, text) from public, anon, authenticated;
grant execute on function public.streetgangstar_join_room(uuid, bigint, text, text) to service_role;
