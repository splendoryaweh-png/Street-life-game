import { NextResponse } from 'next/server';
import {
  createSupabaseServiceClient,
  verifyTelegramInitData,
  isStreetLifeAdmin,
} from '@/lib/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FEATURE_KEY = 'leaderboard';

export async function GET(request: Request) {
  try {
    const initData = request.headers.get('x-telegram-init-data') || '';
    verifyTelegramInitData(initData);

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('streetlife_feature_settings')
      .select('is_visible')
      .eq('feature_key', FEATURE_KEY)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json(
      { ok: true, leaderboardVisible: data?.is_visible === true },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error) {
    console.error('Feature settings GET error:', error);
    return NextResponse.json(
      { error: 'Could not load feature settings.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: Request) {
  try {
    const initData = request.headers.get('x-telegram-init-data') || '';
    const admin = verifyTelegramInitData(initData);

    if (!isStreetLifeAdmin(admin.id)) {
      return NextResponse.json({ error: 'Access denied. Admin only.' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.leaderboardVisible !== 'boolean') {
      return NextResponse.json({ error: 'A valid leaderboard visibility value is required.' }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from('streetlife_feature_settings')
      .upsert({
        feature_key: FEATURE_KEY,
        is_visible: body.leaderboardVisible,
        updated_at: new Date().toISOString(),
        updated_by_telegram_id: String(admin.id),
      }, { onConflict: 'feature_key' });

    if (error) throw error;

    return NextResponse.json(
      { ok: true, leaderboardVisible: body.leaderboardVisible },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error) {
    console.error('Feature settings POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not update feature settings.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
