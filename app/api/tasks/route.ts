import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isAdmin(telegramId: string | null) {
  if (!telegramId) return false;
  const ids = (process.env.STREETLIFE_ADMIN_TELEGRAM_IDS || process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(String(telegramId));
}

function getTelegramId(req: Request) {
  const url = new URL(req.url);
  return (
    req.headers.get('x-telegram-id') ||
    url.searchParams.get('telegram_id') ||
    url.searchParams.get('telegramId') ||
    null
  );
}

// GET - List all pending submissions for admin
export async function GET(req: Request) {
  try {
    const telegramId = getTelegramId(req);
    if (!isAdmin(telegramId)) {
      return NextResponse.json({ error: 'Admin access denied' }, { status: 403 });
    }
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('task_submissions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ submissions: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

// POST - Approve or Reject
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { submission_id, action, telegram_id } = body;
    const adminId = telegram_id || getTelegramId(req);
    if (!isAdmin(String(adminId || ''))) {
      return NextResponse.json({ error: 'Admin access denied' }, { status: 403 });
    }
    if (!submission_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'submission_id and action (approve/reject) required' }, { status: 400 });
    }
    const supabase = getAdminClient();
    if (action === 'approve') {
      const { error } = await supabase.rpc('approve_streetlife_task', {
        p_submission_id: submission_id,
        p_admin_telegram_id: String(adminId),
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, message: 'Approved' });
    } else {
      const { error } = await supabase.rpc('reject_streetlife_task', {
        p_submission_id: submission_id,
        p_admin_telegram_id: String(adminId),
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, message: 'Rejected' });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
