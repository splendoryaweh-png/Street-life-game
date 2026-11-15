import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function verifyTelegramInitData(initData: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !initData || initData.length > 8192) return null;

  try {
    const params = new URLSearchParams(initData);
    const suppliedHash = params.get('hash');
    if (!suppliedHash || !/^[a-f0-9]{64}$/i.test(suppliedHash)) return null;

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
    const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest();
    const receivedHash = Buffer.from(suppliedHash, 'hex');

    if (receivedHash.length !== expectedHash.length || !timingSafeEqual(receivedHash, expectedHash)) return null;

    const authDate = Number(params.get('auth_date'));
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (!Number.isFinite(authDate) || ageSeconds < -60 || ageSeconds > 600) return null;

    const userRaw = params.get('user');
    if (!userRaw) return null;
    const user = JSON.parse(userRaw);
    if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) return null;
    return user;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const user = verifyTelegramInitData(
      typeof body?.initData === 'string' ? body.initData : ''
    );

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired Telegram authentication.' }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Player database is not configured.' }, { status: 503 });
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc('claim_streetlife_daily_login', {
      p_telegram_id: user.id,
    });

    if (error) {
      console.error('Daily login claim RPC failed:', error);
      return NextResponse.json({ error: 'Could not process daily login reward.' }, { status: 500 });
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result) {
      return NextResponse.json({ error: 'Daily login service returned no result.' }, { status: 500 });
    }

    if (!result.success) {
      return NextResponse.json(
        { ok: false, ...result },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { ok: true, ...result },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Daily login route error:', error);
    return NextResponse.json({ error: 'Daily login service failed.' }, { status: 500 });
  }
}
