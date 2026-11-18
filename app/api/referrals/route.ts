import { NextResponse } from 'next/server';
import { createSupabaseServiceClient, verifyTelegramInitData } from '@/lib/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function verifiedUser(request: Request) {
  return verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '');
}

async function ensurePlayer(supabase: ReturnType<typeof createSupabaseServiceClient>, user: Awaited<ReturnType<typeof verifiedUser>>) {
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

async function getReferralSummary(supabase: ReturnType<typeof createSupabaseServiceClient>, telegramId: number) {
  const { data: referralCode, error: codeError } = await supabase.rpc('ensure_streetlife_referral_code', {
    p_telegram_id: telegramId,
  });
  if (codeError) throw codeError;

  const [{ count: referralsCount, error: countError }, { data: claim, error: claimError }] = await Promise.all([
    supabase.from('streetlife_referral_claims')
      .select('invitee_telegram_id', { count: 'exact', head: true })
      .eq('inviter_telegram_id', telegramId),
    supabase.from('streetlife_referral_claims')
      .select('referral_code')
      .eq('invitee_telegram_id', telegramId)
      .maybeSingle(),
  ]);
  if (countError) throw countError;
  if (claimError) throw claimError;

  const { data: player, error: playerError } = await supabase.from('players')
    .select('coins').eq('telegram_id', telegramId).single();
  if (playerError) throw playerError;

  return {
    referralCode: String(referralCode || ''),
    referralsCount: referralsCount || 0,
    balance: Number(player.coins || 0),
    hasClaimedWelcomeBonus: Boolean(claim),
    appliedReferralCode: claim?.referral_code || null,
  };
}

export async function GET(request: Request) {
  try {
    const user = await verifiedUser(request);
    const supabase = createSupabaseServiceClient();
    await ensurePlayer(supabase, user);
    const summary = await getReferralSummary(supabase, user.id);
    return NextResponse.json({ ok: true, ...summary }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Referral service unavailable.';
    console.error('Referral profile request failed:', error);
    const isTelegramAuthError = /initData|Telegram verification|session expired|Missing Telegram|Telegram user/i.test(message);
    return NextResponse.json(
      { error: isTelegramAuthError ? message : 'Referral service is temporarily unavailable.' },
      { status: isTelegramAuthError ? 401 : 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const user = await verifiedUser(request);
    const code = String(body?.referralCode || '').trim().toUpperCase();
    if (!code || code.length > 32) {
      return NextResponse.json({ error: 'Enter a valid referral code.' }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    await ensurePlayer(supabase, user);
    const { data, error } = await supabase.rpc('claim_streetlife_referral', {
      p_invitee_telegram_id: user.id,
      p_referral_code: code,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) {
      return NextResponse.json({ error: result?.message || 'Referral could not be claimed.' }, { status: 409 });
    }

    const summary = await getReferralSummary(supabase, user.id);
    return NextResponse.json({
      ok: true,
      message: result.message,
      inviteeReward: Number(result.invitee_reward || 520),
      inviterReward: Number(result.inviter_reward || 100),
      ...summary,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Referral claim failed.';
    const status = /initData|Telegram verification|session expired|Missing Telegram/i.test(message) ? 401 : 503;
    return NextResponse.json({ error: status === 401 ? message : 'Referral service is temporarily unavailable.' }, { status });
  }
}
