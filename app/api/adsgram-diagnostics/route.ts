import { NextResponse } from 'next/server';
import {
  createSupabaseServiceClient,
  verifyTelegramInitData,
} from '@/lib/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_EVENTS = new Set([
  'ad_requested',
  'sdk_loaded',
  'controller_initialized',
  'ad_started',
  'ad_completed',
  'ad_failed',
  'reward_granted',
]);

export async function POST(request: Request) {
  try {
    const initData = request.headers.get('x-telegram-init-data') || '';
    const user = verifyTelegramInitData(initData);
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' ||
        typeof body.eventId !== 'string' ||
        typeof body.sessionId !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(body.eventId) ||
        !/^[0-9a-f-]{36}$/i.test(body.sessionId) ||
        body.blockId !== '59485' ||
        !ALLOWED_EVENTS.has(body.eventType)) {
      return NextResponse.json({ error: 'Invalid diagnostic event.' }, { status: 400 });
    }

    const elapsedMs = Number.isInteger(body.elapsedMs)
      ? Math.max(0, Math.min(600000, body.elapsedMs))
      : null;

    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from('adsgram_diagnostic_events')
      .insert({
        event_id: body.eventId,
        session_id: body.sessionId,
        telegram_id: user.id,
        block_id: '59485',
        event_type: body.eventType,
        sdk_state: typeof body.sdkState === 'string' ? body.sdkState.slice(0, 32) : null,
        done: typeof body.done === 'boolean' ? body.done : null,
        error: typeof body.error === 'boolean' ? body.error : null,
        description: typeof body.description === 'string' ? body.description.slice(0, 240) : null,
        elapsed_ms: elapsedMs,
      });

    if (error && error.code !== '23505') {
      console.error('Adsgram diagnostic insert failed:', error);
      return NextResponse.json({ error: 'Could not save diagnostic event.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Diagnostic request failed.';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
