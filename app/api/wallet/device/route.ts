import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createSupabaseServiceClient, verifyTelegramInitData } from '@/lib/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getDeviceKeyHash(deviceId: string): string {
  const secret = process.env.STREETLIFE_DEVICE_WALLET_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('Server configuration missing STREETLIFE_DEVICE_WALLET_SECRET (minimum 32 characters).');
  }
  return crypto.createHmac('sha256', secret).update(deviceId).digest('hex');
}

export async function GET(request: Request) {
  try {
    const initData = request.headers.get('x-telegram-init-data') || '';
    const user = verifyTelegramInitData(initData);
    const deviceId = request.headers.get('x-streetlife-device-id') || '';
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(deviceId)) {
      return NextResponse.json({ error: 'A valid device identifier is required.' }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc('get_or_create_device_coin_wallet', {
      p_telegram_id: user.id,
      p_device_key_hash: getDeviceKeyHash(deviceId),
    });
    if (error) {
      console.error('Device wallet lookup failed:', error);
      return NextResponse.json({ error: 'Street Coin wallet is not ready yet.' }, { status: 503 });
    }

    const wallet = Array.isArray(data) ? data[0] : data;
    if (!wallet?.wallet_id) {
      return NextResponse.json({ error: 'Street Coin wallet could not be loaded.' }, { status: 503 });
    }
    return NextResponse.json({
      balance: Number(wallet.balance || 0),
      walletReady: true,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify wallet request.';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
