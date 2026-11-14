import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { telegram_id, username, first_name, last_name, photo_url } = body;
    if (!telegram_id) {
      return NextResponse.json({ error: 'telegram_id required' }, { status: 400 });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const { data: existing } = await supabase
      .from('players')
      .select('*')
      .eq('telegram_id', String(telegram_id))
      .maybeSingle();

    if (existing) {
      await supabase.from('players').update({
        username: username || existing.username,
        first_name: first_name || existing.first_name,
        last_name: last_name || existing.last_name,
        photo_url: photo_url || existing.photo_url,
        updated_at: new Date().toISOString(),
      }).eq('telegram_id', String(telegram_id));
      return NextResponse.json({ ok: true, player: existing });
    }

    const { data, error } = await supabase.from('players').insert({
      telegram_id: String(telegram_id),
      username: username || null,
      first_name: first_name || null,
      last_name: last_name || null,
      photo_url: photo_url || null,
      coins: 1000,
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ ok: true, player: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
