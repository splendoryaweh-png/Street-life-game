
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase server credentials are missing.');
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function verifyInitData(initData: string) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token || !initData) return null;

    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');

    if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) {
      return null;
    }

    params.delete('hash');

    const pairs: string[] = [];

    params.forEach((value, key) => {
      pairs.push(`${key}=${value}`);
    });

    pairs.sort();

    const dataCheckString = pairs.join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(token)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest();

    const suppliedHash = Buffer.from(receivedHash, 'hex');

    if (
      suppliedHash.length !== calculatedHash.length ||
      !crypto.timingSafeEqual(suppliedHash, calculatedHash)
    ) {
      return null;
    }

    const authDate = Number(params.get('auth_date'));

    if (!Number.isFinite(authDate)) return null;

    // Reject Telegram login data older than 24 hours.
    const age = Math.floor(Date.now() / 1000) - authDate;

    if (age < -60 || age > 86400) return null;

    const userData = params.get('user');

    if (!userData) return null;

    const user = JSON.parse(userData);

    if (!user?.id) return null;

    return user;
  } catch {
    return null;
  }
}

function isAdmin(telegramId: string | number) {
  const configuredAdmins =
    process.env.STREETLIFE_ADMIN_TELEGRAM_IDS ||
    process.env.ADMIN_TELEGRAM_IDS ||
    process.env.ADMIN_TELEGRAM_ID ||
    '';

  const adminIds = configuredAdmins
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  // Never allow access if no admin IDs are configured.
  if (adminIds.length === 0) return false;

  return adminIds.includes(String(telegramId));
}

function getAdmin(request: Request, body?: any) {
  const initData =
    typeof body?.initData === 'string'
      ? body.initData
      : request.headers.get('x-telegram-init-data') || '';

  if (!initData) return null;

  const user = verifyInitData(initData);

  if (!user) return null;

  if (!isAdmin(user.id)) return null;

  return user;
}

export async function GET(request: Request) {
  try {
    const admin = getAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: 'Access denied. Admin only.' },
        { status: 403 }
      );
    }

    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from('task_submissions')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(300);

    if (error) throw error;

    return NextResponse.json(
      { ok: true, submissions: data || [] },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Admin tasks GET error:', error);

    return NextResponse.json(
      { error: 'Could not load task submissions.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    const admin = getAdmin(request, body);

    if (!admin) {
      return NextResponse.json(
        { error: 'Access denied. Admin only.' },
        { status: 403 }
      );
    }

    if (
      !body ||
      typeof body.submissionId !== 'string' ||
      !body.submissionId.trim() ||
      !['approve', 'reject'].includes(body.action)
    ) {
      return NextResponse.json(
        { error: 'Invalid review request.' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    if (body.action === 'approve') {
      const { data, error } = await supabase.rpc(
        'approve_streetlife_task',
        {
          p_submission_id: body.submissionId,
          p_admin_telegram_id: String(admin.id),
        }
      );

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;

      if (!result?.success) {
        return NextResponse.json(
          {
            error:
              result?.message ||
              'Could not approve this submission.',
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        ok: true,
        message: result.message,
        credited: result.credited,
      });
    }

    const reason =
      typeof body.reason === 'string' && body.reason.trim()
        ? body.reason.trim().slice(0, 500)
        : 'Proof was not accepted';

    const { data, error } = await supabase.rpc(
      'reject_streetlife_task',
      {
        p_submission_id: body.submissionId,
        p_admin_telegram_id: String(admin.id),
        p_reason: reason,
      }
    );

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        {
          error:
            'This submission is no longer pending or could not be rejected.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Submission rejected. No coins were credited.',
    });
  } catch (error) {
    console.error('Admin tasks POST error:', error);

    return NextResponse.json(
      { error: 'Could not review this submission.' },
      { status: 500 }
    );
  }
}
