
import { NextResponse } from 'next/server';
import {
  createSupabaseServiceClient,
  verifyTelegramInitData,
  isStreetLifeAdmin,
} from '@/lib/server/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAdmin(request: Request, body?: any) {
  try {
    const initData =
      typeof body?.initData === 'string'
        ? body.initData
        : request.headers.get('x-telegram-init-data') || '';

    if (!initData) return null;

    const user = verifyTelegramInitData(initData);

    if (!isStreetLifeAdmin(user.id)) return null;

    return user;
  } catch {
    return null;
  }
}

// Load submissions for the authenticated admin.
export async function GET(request: Request) {
  try {
    const admin = getAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin access denied.' },
        { status: 403 }
      );
    }

    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
      .from('task_submissions')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(300);

    if (error) throw error;

    return NextResponse.json(
      { submissions: data || [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Admin task GET error:', error);

    return NextResponse.json(
      { error: 'Could not load task submissions.' },
      { status: 500 }
    );
  }
}

// Approve or reject a player's external task submission.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    const admin = getAdmin(request, body);

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin access denied.' },
        { status: 403 }
      );
    }

    if (
      !body ||
      typeof body.submissionId !== 'string' ||
      !['approve', 'reject'].includes(body.action)
    ) {
      return NextResponse.json(
        { error: 'Invalid review request.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceClient();

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
            error: result?.message || 'Could not approve this submission.',
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
      typeof body.reason === 'string'
        ? body.reason.slice(0, 500)
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
          error: 'This submission is no longer pending or could not be rejected.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Submission rejected. No coins were credited.',
    });
  } catch (error) {
    console.error('Admin task POST error:', error);

    return NextResponse.json(
      { error: 'Could not review this submission.' },
      { status: 500 }
    );
  }
}
