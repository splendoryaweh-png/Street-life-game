import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const telegram_id = body.telegram_id || body.telegramId || body.id;
    const username = body.username || null;
    const first_name = body.first_name || body.firstName || 'Player';
    const last_name = body.last_name || body.lastName || null;
    const photo_url = body.photo_url || body.photoUrl || null;

    if (!telegram_id) {
      return NextResponse.json({ error: 'telegram_id required' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const tid = String(telegram_id);

    // Check if player exists
    const { data: existing } = await supabase
      .from('players')
      .select('*')
      .eq('telegram_id', tid)
      .single();

    if (existing) {
      await supabase
        .from('players')
        .update({ username, first_name, last_name, photo_url, updated_at: new Date().toISOString() })
        .eq('telegram_id', tid);
      return NextResponse.json({ ok: true, player: existing });
    }

    const { data: created, error } = await supabase
      .from('players')
      .insert([{ telegram_id: tid, username, first_name, last_name, photo_url, coins: 0 }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, player: created });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Auth failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Telegram auth endpoint' });
}
