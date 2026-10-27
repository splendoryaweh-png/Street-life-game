
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

function verifyTelegramData(
  initData: string,
  botToken: string
): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const authDate = Number(params.get('auth_date'));

  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (!authDate || authDate > now + 60 || now - authDate > 86400) {
    return null;
  }

  const checkString = [...params.entries()]
    .filter(([key]) => key !== 'hash' && key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const expected = createHmac('sha256', secret)
    .update(checkString)
    .digest();

  const received = Buffer.from(hash, 'hex');

  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    return null;
  }

  try {
    const user = JSON.parse(params.get('user') || 'null') as TelegramUser;
    return Number.isSafeInteger(user?.id) && user.id > 0 ? user : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!botToken || !supabaseUrl || !secretKey) {
      return NextResponse.json(
        { error: 'Server environment variables are missing.' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);

    if (
      !body ||
      typeof body.initData !== 'string' ||
      body.initData.length > 20000
    ) {
      return NextResponse.json(
        { error: 'Missing Telegram login data.' },
        { status: 400 }
      );
    }

    const user = verifyTelegramData(body.initData, botToken);

    if (!user) {
      return NextResponse.json(
        { error: 'Telegram verification failed. Open the game through Telegram.' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const telegramId = String(user.id);

    const profile = {
      username: user.username ?? null,
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
      photo_url: user.photo_url ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: lookupError } = await supabase
      .from('players')
      .select('telegram_id')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (lookupError) {
      console.error('Player lookup:', lookupError.message);
      return NextResponse.json(
        { error: 'Could not check player account. Check your players table.' },
        { status: 500 }
      );
    }

    if (existing) {
      const { error } = await supabase
        .from('players')
        .update(profile)
        .eq('telegram_id', telegramId);

      if (error) {
        console.error('Player update:', error.message);
        return NextResponse.json(
          { error: 'Could not update player account.' },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, created: false });
    }

    const referralCode = `SL${randomBytes(5).toString('hex').toUpperCase()}`;

    const { error: insertError } = await supabase
      .from('players')
      .insert({
        telegram_id: telegramId,
        ...profile,
        coins: 0,
        referral_code: referralCode,
      });

    if (insertError) {
      console.error('Player creation:', insertError.message);
      return NextResponse.json(
        { error: 'Could not create player. Check your players table columns.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, created: true });
  } catch (error) {
    console.error('Telegram authentication error:', error);
    return NextResponse.json(
      { error: 'Unexpected server error.' },
      { status: 500 }
    );
  }
}
