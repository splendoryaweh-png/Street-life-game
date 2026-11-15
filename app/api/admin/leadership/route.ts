import { NextResponse } from 'next/server';
import { createSupabaseServiceClient, verifyTelegramInitData, isStreetLifeAdmin } from '@/lib/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorize(request: Request) {
  const initData = request.headers.get('x-telegram-init-data') || '';
  const user = verifyTelegramInitData(initData);
  if (!isStreetLifeAdmin(user.id)) throw new Error('ADMIN_FORBIDDEN');
  return user;
}

export async function GET(request: Request) {
  try {
    await authorize(request);
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
    const supabase = createSupabaseServiceClient();

    const { data: members, error: memberError } = await supabase
      .from('leadership_members')
      .select('telegram_id,is_active,added_by_telegram_id,created_at')
      .order('created_at', { ascending: false });
    if (memberError) throw memberError;

    const ids = (members || []).map((m: any) => String(m.telegram_id));
    let players: any[] = [];
    if (ids.length) {
      const { data, error } = await supabase
        .from('players')
        .select('telegram_id,username,first_name,last_name,photo_url')
        .in('telegram_id', ids);
      if (error) throw error;
      players = data || [];
    }

    let searchResults: any[] = [];
    if (q) {
      const numeric = /^\\d+$/.test(q);
      let query = supabase.from('players')
        .select('telegram_id,username,first_name,last_name,photo_url')
        .limit(20);
      if (numeric) query = query.eq('telegram_id', Number(q));
      else query = query.or('username.ilike.%' + q.replace(/[,%()]/g, '') + '%,first_name.ilike.%' + q.replace(/[,%()]/g, '') + '%,last_name.ilike.%' + q.replace(/[,%()]/g, '') + '%');
      const { data, error } = await query;
      if (error) throw error;
      searchResults = data || [];
    }

    const { data: adjustments, error: adjustmentError } = await supabase
      .from('leadership_admin_adjustments')
      .select('id,telegram_id,action,amount,reason,admin_telegram_id,created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (adjustmentError) throw adjustmentError;

    const { data: events, error: eventError } = await supabase
      .from('leadership_activity_events')
      .select('telegram_id,event_type,coin_amount,occurred_at')
      .limit(5000);
    if (eventError) throw eventError;

    const playerById = new Map(players.map((p: any) => [String(p.telegram_id), p]));
    const adjustmentTotals = new Map<string, number>();
    for (const a of adjustments || []) {
      const id = String(a.telegram_id);
      adjustmentTotals.set(id, (adjustmentTotals.get(id) || 0) + (a.action === 'award' ? a.amount : -a.amount));
    }
    const eventTotals = new Map<string, number>();
    for (const e of events || []) {
      const id = String(e.telegram_id);
      eventTotals.set(id, (eventTotals.get(id) || 0) + (e.event_type === 'coin_earned' ? Number(e.coin_amount || 0) : 0));
    }
    const memberRows = (members || []).map((m: any) => ({
      ...m,
      player: playerById.get(String(m.telegram_id)) || null,
      manualPoints: adjustmentTotals.get(String(m.telegram_id)) || 0,
      verifiedCoins: eventTotals.get(String(m.telegram_id)) || 0,
    }));
    return NextResponse.json({ ok: true, members: memberRows, searchResults, adjustments: adjustments || [] }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === 'ADMIN_FORBIDDEN';
    console.error('Admin leadership GET error:', error);
    return NextResponse.json({ error: forbidden ? 'Admin access required.' : 'Could not load Leadership Board data.' }, { status: forbidden ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await authorize(request);
    const body = await request.json();
    const telegramId = Number(body.telegramId);
    if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
      return NextResponse.json({ error: 'Enter a valid registered Telegram ID.' }, { status: 400 });
    }
    const supabase = createSupabaseServiceClient();

    if (body.action === 'add') {
      const { data: player, error: playerError } = await supabase
        .from('players').select('telegram_id').eq('telegram_id', telegramId).maybeSingle();
      if (playerError) throw playerError;
      if (!player) return NextResponse.json({ error: 'This player is not registered.' }, { status: 404 });
      const { error } = await supabase.from('leadership_members').upsert({
        telegram_id: telegramId, is_active: true, added_by_telegram_id: String(admin.id), updated_at: new Date().toISOString(),
      }, { onConflict: 'telegram_id' });
      if (error) throw error;
      return NextResponse.json({ ok: true, message: 'Registered player added to the Leadership Board.' });
    }

    if (body.action === 'remove') {
      const { error } = await supabase.from('leadership_members')
        .update({ is_active: false, updated_at: new Date().toISOString() }).eq('telegram_id', telegramId);
      if (error) throw error;
      return NextResponse.json({ ok: true, message: 'Player removed from the active Leadership Board. Account retained.' });
    }

    if (body.action === 'adjust') {
      const action = body.adjustment;
      const amount = Number(body.amount);
      const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
      if (!['award', 'deduction'].includes(action) || !Number.isSafeInteger(amount) || amount <= 0 || !reason) {
        return NextResponse.json({ error: 'Choose award or deduction, enter a positive whole number, and provide a reason.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('adjust_leadership_points', {
        p_telegram_id: telegramId,
        p_action: action,
        p_amount: amount,
        p_reason: reason,
        p_admin_telegram_id: String(admin.id),
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.success) return NextResponse.json({ error: result?.message || 'Points adjustment was not accepted.' }, { status: 400 });
      return NextResponse.json({ ok: true, message: result.message, adjustedBalance: result.adjusted_balance });
    }

    return NextResponse.json({ error: 'Unsupported Leadership Board action.' }, { status: 400 });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === 'ADMIN_FORBIDDEN';
    console.error('Admin leadership POST error:', error);
    return NextResponse.json({ error: forbidden ? 'Admin access required.' : 'Leadership Board action failed.' }, { status: forbidden ? 403 : 500 });
  }
}
