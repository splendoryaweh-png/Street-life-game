import { NextResponse } from 'next/server';
import { createSupabaseServiceClient, verifyTelegramInitData } from '@/lib/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function initData(request: Request, body?: any) {
  return typeof body?.initData === 'string' ? body.initData : request.headers.get('x-telegram-init-data') || '';
}

async function ensurePlayer(supabase: ReturnType<typeof createSupabaseServiceClient>, user: ReturnType<typeof verifyTelegramInitData>) {
  const { error } = await supabase.from('players').upsert({
    telegram_id: String(user.id),
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    photo_url: user.photo_url || null,
    coins: 1000,
  }, { onConflict: 'telegram_id', ignoreDuplicates: true });
  if (error) throw new Error('Could not load your player account.');
}

export async function GET(request: Request) {
  try {
    const user = verifyTelegramInitData(initData(request));
    const supabase = createSupabaseServiceClient();
    await ensurePlayer(supabase, user);
    const { data: code, error } = await supabase.rpc('ensure_streetlife_referral_code', { p_telegram_id: user.id });
    if (error) throw error;
    const { count, error: countError } = await supabase
      .from('streetlife_referral_claims')
      .select('invitee_telegram_id', { count: 'exact', head: true })
      .eq('inviter_telegram_id', user.id);
    if (countError) throw countError;
    return NextResponse.json({ ok: true, referralCode: code, referralsCount: count || 0 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Referral service unavailable.';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const user = verifyTelegramInitData(initData(request, body));
    const code = String(body?.referralCode || '').trim().toUpperCase();
    if (!code || code.length > 32) return NextResponse.json({ error: 'Enter a valid referral code.' }, { status: 400 });
    const supabase = createSupabaseServiceClient();
    await ensurePlayer(supabase, user);
    const { data, error } = await supabase.rpc('claim_streetlife_referral', {
      p_invitee_telegram_id: user.id,
      p_referral_code: code,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) return NextResponse.json({ error: result?.message || 'Referral could not be claimed.' }, { status: 409 });
    return NextResponse.json({ ok: true, message: result.message, inviteeReward: Number(result.invitee_reward), inviterReward: Number(result.inviter_reward) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Referral claim failed.';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
