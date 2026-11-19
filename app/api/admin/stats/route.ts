import { NextResponse } from 'next/server';
import { createSupabaseServiceClient, verifyTelegramInitData } from '@/lib/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isConfiguredAdmin(telegramId: number): boolean {
  const configured =
    process.env.STREETLIFE_ADMIN_TELEGRAM_IDS ||
    process.env.ADMIN_TELEGRAM_IDS ||
    process.env.ADMIN_TELEGRAM_ID ||
    '';

  return configured
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(String(telegramId));
}

export async function GET(request: Request) {
  try {
    const initData = request.headers.get('x-telegram-init-data') || '';
    const admin = verifyTelegramInitData(initData);

    if (!isConfiguredAdmin(admin.id)) {
      return NextResponse.json({ error: 'Access denied. Admin only.' }, { status: 403 });
    }

    const supabase = createSupabaseServiceClient();
    const { count, error } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;

    const { count: totalSongs, error: songsError } = await supabase
      .from('studio_group_song_posts')
      .select('id', { count: 'exact', head: true });

    if (songsError) throw songsError;

    return NextResponse.json(
      { ok: true, totalPlayers: count ?? 0, totalSongs: totalSongs ?? 0 },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error) {
    console.error('Admin player count GET error:', error);
    return NextResponse.json(
      { error: 'Could not load the registered player count.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
