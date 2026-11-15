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

    const rawUser = params.get('user');
    if (!rawUser) return null;
    const user = JSON.parse(rawUser);
    return user && Number.isSafeInteger(user.id) && user.id > 0 ? user : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const user = verifyTelegramInitData(typeof body?.initData === 'string' ? body.initData : '');
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired Telegram authentication.' }, { status: 401 });
    }

    const requestId = typeof body?.requestId === 'string' ? body.requestId : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      return NextResponse.json({ error: 'Invalid purchase request ID.' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Player database is not configured.' }, { status: 503 });
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc('purchase_streetlife_racing_nitro', {
      p_telegram_id: user.id,
      p_request_id: requestId,
    });

    if (error) {
      console.error('Racing Nitro purchase RPC failed:', error);
      return NextResponse.json({ error: 'Could not process Nitro purchase.' }, { status: 500 });
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result) return NextResponse.json({ error: 'Purchase service returned no result.' }, { status: 500 });

    return NextResponse.json(
      { ok: result.success === true, ...result },
      {
        status: result.success === true ? 200 : 409,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error('Racing Nitro purchase route error:', error);
    return NextResponse.json({ error: 'Purchase service failed.' }, { status: 500 });
  }
}
