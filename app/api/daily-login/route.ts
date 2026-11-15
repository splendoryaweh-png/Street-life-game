import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createSupabaseServiceClient, verifyTelegramInitData } from '@/lib/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const initData = request.headers.get('x-telegram-init-data') || '';
    const user = verifyTelegramInitData(initData);
    const deviceId = request.headers.get('x-streetlife-device-id') || '';
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(deviceId)) return NextResponse.json({ error: 'A valid device identifier is required.' }, { status: 400 });
    const secret = process.env.STREETLIFE_DEVICE_WALLET_SECRET;
    if (!secret || secret.length < 32) throw new Error('Wallet secret is not configured.');
    const deviceKeyHash = crypto.createHmac('sha256', secret).update(deviceId).digest('hex');
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc('claim_streetlife_daily_login_device', {
      p_telegram_id: user.id,
      p_device_key_hash: deviceKeyHash,
    });

    if (error) {
      console.error('Daily login claim failed:', error);
      const status = error.message?.includes('Registered player not found') ? 404 : 500;
      return NextResponse.json({ error: status === 404 ? 'Register your player account before claiming.' : 'Daily reward is temporarily unavailable. Please try again.' }, { status });
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) {
      return NextResponse.json({ error: 'Daily reward could not be claimed.' }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      alreadyClaimed: Boolean(result.already_claimed),
      reward: Number(result.reward_sc),
      streak: Number(result.streak_day),
      perk: result.perk,
      claimDate: result.claim_date,
      balance: Number(result.wallet_balance || 0),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Telegram verification failed.';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
