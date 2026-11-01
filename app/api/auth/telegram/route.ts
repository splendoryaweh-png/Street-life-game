
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
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    const authDate = Number(params.get('auth_date'));

    if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return null;

    const now = Math.floor(Date.now() / 1000);

    if (
      !Number.isSafeInteger(authDate) ||
      authDate <= 0 ||
      authDate > now + 60 ||
      now - authDate > 86400
    ) {
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

    const user = JSON.parse(params.get('user') || 'null') as TelegramUser;

    if (
      !user ||
      !Number.isSafeInteger(user.id) ||
      user.id <= 0
    ) {
      return null;
    }

    return user;
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
      console.error('Missing server environment variables.');

      return NextResponse.json(
        { error: 'Server configuration is incomplete.' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);

    if (
      !body ||
      typeof body.initData !== 'string' ||
      body.initData.length === 0 ||
      body.initData.length > 20000
    ) {
      return NextResponse.json(
        { error: 'Missing or invalid Telegram login data.' },
        { status: 400 }
      );
    }

    const user = verifyTelegramData(body.initData, botToken);

    if (!user) {
      return NextResponse.json(
        {
          error:
            'Telegram verification failed. Open the game through Telegram.'
        },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const telegramId = user.id;

    const profile = {
      username: user.username ?? null,
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
      photo_url: user.photo_url ?? null,
      updated_at: new Date().toISOString()
    };

    // Check whether this Telegram player already exists.
    const { data: existing, error: lookupError } = await supabase
      .from('players')
      .select('telegram_id')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (lookupError) {
      console.error('Player lookup failed:', lookupError.message);

      return NextResponse.json(
        { error: 'Could not check player account.' },
        { status: 500 }
      );
    }

    // Existing players only need their profile updated.
    if (existing) {
      const { error: updateError } = await supabase
        .from('players')
        .update(profile)
        .eq('telegram_id', telegramId);

      if (updateError) {
        console.error('Player update failed:', updateError.message);

        return NextResponse.json(
          { error: 'Could not update player account.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        created: false,
        referralApplied: false
      });
    }

    // Create a unique referral code for the new player.
    const myReferralCode =
      `SL${randomBytes(5).toString('hex').toUpperCase()}`;

    const rawReferralCode =
      typeof body.referralCode === 'string'
        ? body.referralCode.trim().toUpperCase().slice(0, 20)
        : '';

    // Check the referral code before creating the player.
    let validReferralCode: string | null = null;

    if (rawReferralCode) {
      const { data: referrer, error: referralLookupError } =
        await supabase
          .from('players')
          .select('telegram_id')
          .eq('referral_code', rawReferralCode)
          .maybeSingle();

      if (referralLookupError) {
        console.error(
          'Referral lookup failed:',
          referralLookupError.message
        );

        return NextResponse.json(
          { error: 'Could not verify referral code.' },
          { status: 500 }
        );
      }

      if (
        referrer &&
        Number(referrer.telegram_id) !== telegramId
      ) {
        validReferralCode = rawReferralCode;
      }
    }

    // Create the player first. Never award the referrer before
    // the new player's account has successfully been created.
    const insertData = {
      telegram_id: telegramId,
      ...profile,
      coins: 0,
      referral_code: myReferralCode
    };

    const { error: insertError } = await supabase
      .from('players')
      .insert(insertData);

    if (insertError) {
      console.error('Player creation failed:', insertError.message);

      // A concurrent login may have created the same player.
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Player account already exists. Please reopen the game.' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Could not create player account. Check the players table.' },
        { status: 500 }
      );
    }

    // Referral rewards are handled by one database function.
    // This function must be installed in Supabase before referrals
    // can be credited.
    let referralApplied = false;

    if (validReferralCode) {
      const { data: referralResult, error: referralError } =
        await supabase.rpc('apply_streetlife_referral', {
          p_new_player_telegram_id: telegramId,
          p_referral_code: validReferralCode
        });

      if (referralError) {
        console.error(
          'Referral reward failed:',
          referralError.message
        );
      } else {
        referralApplied =
          referralResult === true ||
          referralResult?.success === true;
      }
    }

    return NextResponse.json({
      ok: true,
      created: true,
      referralApplied
    });
  } catch (error) {
    console.error('Telegram authentication error:', error);

    return NextResponse.json(
      { error: 'Unexpected server error.' },
      { status: 500 }
    );
  }
}
