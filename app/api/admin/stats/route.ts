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

    const supabase = createSupabaseServiceClient();
    const { count, error } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;

    return NextResponse.json(
      { ok: true, totalPlayers: count ?? 0 },
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
