import { NextResponse } from 'next/server';
import {
  createSupabaseServiceClient,
  verifyTelegramInitData,
} from '@/lib/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const initData =
      typeof body?.initData === 'string'
        ? body.initData
        : request.headers.get('x-telegram-init-data') || '';
    const user = verifyTelegramInitData(initData);
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';

    if (!code || code.length > 32) {
      return NextResponse.json({ error: 'Please enter a valid referral code.' }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc('claim_streetlife_referral', {
      p_invitee_telegram_id: user.id,
      p_inviter_code: code,
    });

    if (error) {
      console.error('Referral claim RPC failed:', error);
      return NextResponse.json(
        { error: 'Referral service is temporarily unavailable. Please try again.' },
        { status: 503 }
      );
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) {
      return NextResponse.json(
        { success: false, message: result?.message || 'Referral could not be applied.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      inviteeBonus: Number(result.invitee_bonus || 0),
      inviterBonus: Number(result.inviter_bonus || 0),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Telegram verification failed.';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
