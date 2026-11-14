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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const user = verifyTelegramInitData(typeof body?.initData === 'string' ? body.initData : '');

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired Telegram authentication.' }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Player database is not configured.' }, { status: 503 });
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const profile = {
      telegram_id: String(user.id),
      username: typeof user.username === 'string' ? user.username : null,
      first_name: typeof user.first_name === 'string' ? user.first_name : null,
      last_name: typeof user.last_name === 'string' ? user.last_name : null,
      photo_url: typeof user.photo_url === 'string' ? user.photo_url : null,
      updated_at: new Date().toISOString(),
    };

    const { data: player, error } = await supabase
      .from('players')
      .upsert(profile, { onConflict: 'telegram_id', ignoreDuplicates: false })
      .select('telegram_id, username, first_name, last_name, photo_url, coins')
      .single();

    if (error) {
      console.error('Telegram player upsert failed:', error);
      return NextResponse.json({ error: 'Could not load player profile.' }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, player },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Telegram authentication error:', error);
    return NextResponse.json({ error: 'Authentication service failed.' }, { status: 500 });
  }
}
