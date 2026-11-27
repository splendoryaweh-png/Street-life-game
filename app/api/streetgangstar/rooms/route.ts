import { NextResponse } from 'next/server';
import { randomInt } from 'node:crypto';
import { createSupabaseServiceClient, verifyTelegramInitData } from '@/lib/taskAuth';

export const runtime = 'nodejs';

function cleanText(value: unknown, max: number, fallback: string): string {
  return typeof value === 'string' ? value.trim().slice(0, max) || fallback : fallback;
}

function safeState(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const encoded = JSON.stringify(value);
  if (encoded.length > 8192) throw new Error('Game state payload is too large.');
  return value as Record<string, unknown>;
}

function makeRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = verifyTelegramInitData(String(body?.initData || ''));
    const db = createSupabaseServiceClient();

    const { data: player, error: playerError } = await db
      .from('players')
      .select('telegram_id, username, first_name')
      .eq('telegram_id', user.id)
      .maybeSingle();
    if (playerError) throw playerError;
    if (!player) return NextResponse.json({ error: 'Register your Street Life account before joining a match.' }, { status: 403 });

    const action = body?.action;
    if (action === 'create') {
      const countryCode = cleanText(body?.countryCode, 2, 'NG').toUpperCase();
      const playerName = cleanText(body?.playerName, 24, player.username || player.first_name || 'Street Player');
      const maxPlayers = Math.max(2, Math.min(32, Math.floor(Number(body?.maxPlayers) || 16)));
      for (let attempt = 0; attempt < 5; attempt++) {
        const roomCode = makeRoomCode();
        const { data: room, error } = await db.from('streetgangstar_rooms').insert({
          room_code: roomCode, host_telegram_id: user.id, country_code: countryCode,
          status: 'waiting', max_players: maxPlayers, room_state: {},
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        }).select('id, room_code, country_code, status, max_players').single();
        if (error?.code === '23505') continue;
        if (error) throw error;
        const { error: joinError } = await db.from('streetgangstar_room_players').insert({
          room_id: room.id, telegram_id: user.id, player_name: playerName, team: 'blue',
          is_host: true, player_state: {}, last_seen_at: new Date().toISOString(),
        });
        if (joinError) {
          await db.from('streetgangstar_rooms').delete().eq('id', room.id);
          throw joinError;
        }
        return NextResponse.json({ ok: true, room, playerId: user.id });
      }
      return NextResponse.json({ error: 'Could not create a unique room. Try again.' }, { status: 503 });
    }

    const roomCode = cleanText(body?.roomCode, 8, '').toUpperCase();
    if (!/^[A-Z0-9]{5,8}$/.test(roomCode)) return NextResponse.json({ error: 'Enter a valid room code.' }, { status: 400 });
    const { data: room, error: roomError } = await db.from('streetgangstar_rooms')
      .select('id, room_code, host_telegram_id, country_code, status, max_players, room_state, expires_at')
      .eq('room_code', roomCode).maybeSingle();
    if (roomError) throw roomError;
    if (!room || room.status === 'closed' || new Date(room.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'This room is no longer available.' }, { status: 404 });
    }

    if (action === 'poll') {
      const { data: membership, error: memberError } = await db.from('streetgangstar_room_players')
        .select('telegram_id').eq('room_id', room.id).eq('telegram_id', user.id).maybeSingle();
      if (memberError) throw memberError;
      if (!membership) return NextResponse.json({ error: 'You are not a member of this room.' }, { status: 403 });
      const { data: players, error: playersError } = await db.from('streetgangstar_room_players')
        .select('telegram_id, player_name, team, player_state, is_host, last_seen_at')
        .eq('room_id', room.id).gte('last_seen_at', new Date(Date.now() - 12000).toISOString());
      if (playersError) throw playersError;
      return NextResponse.json({ ok: true, room, players: players || [], playerId: user.id });
    }

    if (action === 'join') {
      const { data: existing, error: existingError } = await db.from('streetgangstar_room_players')
        .select('telegram_id').eq('room_id', room.id).eq('telegram_id', user.id).maybeSingle();
      if (existingError) throw existingError;
      if (!existing) {
        const { count, error: countError } = await db.from('streetgangstar_room_players')
          .select('*', { count: 'exact', head: true }).eq('room_id', room.id);
        if (countError) throw countError;
        if ((count || 0) >= room.max_players) return NextResponse.json({ error: 'This room is full.' }, { status: 409 });
        const playerName = cleanText(body?.playerName, 24, player.username || player.first_name || 'Street Player');
        const team = body?.team === 'red' ? 'red' : 'blue';
        const { error: insertError } = await db.from('streetgangstar_room_players').insert({
          room_id: room.id, telegram_id: user.id, player_name: playerName, team,
          is_host: false, player_state: {}, last_seen_at: new Date().toISOString(),
        });
        if (insertError) throw insertError;
      } else {
        await db.from('streetgangstar_room_players').update({ last_seen_at: new Date().toISOString() })
          .eq('room_id', room.id).eq('telegram_id', user.id);
      }
      return NextResponse.json({ ok: true, room, playerId: user.id });
    }

    if (action === 'heartbeat') {
      const state = safeState(body?.playerState);
      const { data: membership, error: memberError } = await db.from('streetgangstar_room_players')
        .select('is_host').eq('room_id', room.id).eq('telegram_id', user.id).maybeSingle();
      if (memberError) throw memberError;
      if (!membership) return NextResponse.json({ error: 'You are not a member of this room.' }, { status: 403 });
      const { error: updateError } = await db.from('streetgangstar_room_players').update({
        player_state: state, last_seen_at: new Date().toISOString(),
      }).eq('room_id', room.id).eq('telegram_id', user.id);
      if (updateError) throw updateError;
      if (membership.is_host && body?.roomState !== undefined) {
        const roomState = safeState(body.roomState);
        const { error: hostUpdateError } = await db.from('streetgangstar_rooms').update({
          room_state: roomState, status: 'active', updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        }).eq('id', room.id).eq('host_telegram_id', user.id);
        if (hostUpdateError) throw hostUpdateError;
      }
      return NextResponse.json({ ok: true, roomId: room.id });
    }

    return NextResponse.json({ error: 'Unsupported room action.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Room request failed.';
    const status = /Telegram|initData|session expired|signature/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
