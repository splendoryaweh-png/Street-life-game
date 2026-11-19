import { NextResponse } from 'next/server';
import { createSupabaseServiceClient, verifyTelegramInitData, isStreetLifeAdmin } from '@/lib/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const initData = request.headers.get('x-telegram-init-data') || '';
    const admin = verifyTelegramInitData(initData);
    if (!isStreetLifeAdmin(admin.id)) {
      return NextResponse.json({ error: 'Access denied. Admin only.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const daysParam = Number(url.searchParams.get('days') || 7);
    const days = [1, 7, 30, 90].includes(daysParam) ? daysParam : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const supabase = createSupabaseServiceClient();

    const { data, error, count } = await supabase
      .from('adsgram_diagnostic_events')
      .select('event_id, session_id, telegram_id, block_id, event_type, sdk_state, done, error, description, elapsed_ms, created_at', { count: 'exact' })
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;
    const events = data || [];
    const counts = {
      requests: events.filter((e) => e.event_type === 'ad_requested').length,
      sdkLoaded: events.filter((e) => e.event_type === 'sdk_loaded').length,
      started: events.filter((e) => e.event_type === 'ad_started').length,
      completed: events.filter((e) => e.event_type === 'ad_completed').length,
      failed: events.filter((e) => e.event_type === 'ad_failed').length,
      uniquePlayers: new Set(events.map((e) => e.telegram_id)).size,
      uniqueSessions: new Set(events.map((e) => e.session_id)).size,
    };

    return NextResponse.json({
      ok: true,
      blockId: '59485',
      days,
      since,
      generatedAt: new Date().toISOString(),
      totalEvents: count ?? events.length,
      counts,
      events,
      capped: (count ?? events.length) > events.length,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error('Admin Adsgram diagnostics GET error:', error);
    return NextResponse.json({ error: 'Could not load Adsgram diagnostics. Reopen the Mini App as an authorized admin.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
}
