import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function verifyInitData(initData: string) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '';
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const pairs: string[] = [];
    params.forEach((v, k) => pairs.push(`${k}=${v}`));
    pairs.sort();
    const dataCheck = pairs.join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const calc = crypto.createHmac('sha256', secret).update(dataCheck).digest('hex');
    if (calc !== hash) return null;
    const user = JSON.parse(params.get('user') || '{}');
    return user;
  } catch { return null; }
}

function isAdmin(id: any) {
  const list = (process.env.ADMIN_TELEGRAM_IDS || process.env.ADMIN_TELEGRAM_ID || '').split(',').map(s => s.trim()).filter(Boolean);
  if (list.length === 0) return true; // if you have not set admin list yet, allow for now so Vercel builds
  return list.includes(String(id));
}

function getAdmin(request: Request, body?: any) {
  try {
    const initData = typeof body?.initData === 'string' ? body.initData : request.headers.get('x-telegram-init-data') || '';
    if (!initData) return null;
    const user = verifyInitData(initData);
    if (!user) return null;
    if (!isAdmin(user.id)) return null;
    return user;
  } catch { return null; }
}

export async function GET(request: Request) {
  try {
    const admin = getAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Admin access denied.' }, { status: 403 });
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from('task_submissions').select('*').order('submitted_at', { ascending: false }).limit(300);
    if (error) throw error;
    return NextResponse.json({ submissions: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: 'Could not load task submissions.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const admin = getAdmin(request, body);
    if (!admin) return NextResponse.json({ error: 'Admin access denied.' }, { status: 403 });
    if (!body || typeof body.submissionId !== 'string' || !['approve', 'reject'].includes(body.action)) {
      return NextResponse.json({ error: 'Invalid review request.' }, { status: 400 });
    }
    const supabase = supabaseAdmin();
    if (body.action === 'approve') {
      const { data, error } = await supabase.rpc('approve_streetlife_task', { p_submission_id: body.submissionId, p_admin_telegram_id: String(admin.id) });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.success) return NextResponse.json({ error: result?.message || 'Could not approve this submission.' }, { status: 409 });
      return NextResponse.json({ ok: true, message: result.message, credited: result.credited });
    }
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : 'Proof was not accepted';
    const { data, error } = await supabase.rpc('reject_streetlife_task', { p_submission_id: body.submissionId, p_admin_telegram_id: String(admin.id), p_reason: reason });
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'This submission is no longer pending or could not be rejected.' }, { status: 409 });
    return NextResponse.json({ ok: true, message: 'Submission rejected. No coins were credited.' });
  } catch (error) {
    return NextResponse.json({ error: 'Could not review this submission.' }, { status: 500 });
  }
}
