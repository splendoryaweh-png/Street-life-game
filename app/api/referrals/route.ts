import { NextResponse } from 'next/server';
import { createSupabaseServiceClient, verifyTelegramInitData } from '@/lib/taskAuth';
import { randomBytes } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function verifiedUser(request: Request) {
  return verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '');
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

async function getOrAssignReferralCode(supabase: ReturnType<typeof createSupabaseServiceClient>, telegramId: number) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase.from('players').select('referral_code').eq('telegram_id', telegramId).single();
    if (error) throw error;
    const existing = String(data?.referral_code || '').trim();
    if (existing) return existing;
    const code = 'SL' + randomBytes(5).toString('hex').slice(0, 7).toUpperCase();
    const { error: updateError } = await supabase.from('players')
      .update({ referral_code: code, updated_at: new Date().toISOString() })
      .eq('telegram_id', telegramId)
      .or('referral_code.is.null,referral_code.eq.');
    if (updateError && !/duplicate key/i.test(updateError.message)) throw updateError;
  }
  throw new Error('Could not assign a unique referral code. Please retry.');
}

export async function GET(request: Request) {
  try {
    const user = await verifiedUser(request);
    const supabase = createSupabaseServiceClient();
    await ensurePlayer(supabase, user);
    const referralCode = await getOrAssignReferralCode(supabase, user.id);
    const { data: player, error: playerError } = await supabase.from('players')
      .select('referred_by,referred_by_code,coins').eq('telegram_id', user.id).single();
    if (playerError) throw playerError;
    const { count, error: countError } = await supabase.from('players')
      .select('telegram_id', { count: 'exact', head: true })
      .eq('referred_by', String(user.id));
    if (countError) throw countError;
    return NextResponse.json({
      ok: true,
      referralCode,
      referralsCount: count || 0,
      balance: Number(player.coins || 0),
      hasClaimedWelcomeBonus: Boolean(player.referred_by || player.referred_by_code),
      appliedReferralCode: player.referred_by_code || null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Referral service unavailable.';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '');
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
    const { data: player, error: playerError } = await supabase.from('players')
      .select('coins,referred_by_code').eq('telegram_id', user.id).single();
    if (playerError) throw playerError;
    const { count } = await supabase.from('players')
      .select('telegram_id', { count: 'exact', head: true }).eq('referred_by', String(user.id));
    return NextResponse.json({
      ok: true,
      message: result.message,
      inviteeReward: Number(result.invitee_bonus || 520),
      inviterReward: Number(result.inviter_bonus || 100),
      balance: Number(player.coins || 0),
      appliedReferralCode: player.referred_by_code || code,
      referralsCount: count || 0,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Referral claim failed.';
    const status = /initData|Telegram verification|session expired|Missing Telegram/i.test(message) ? 401 : 503;
    return NextResponse.json({ error: status === 401 ? message : 'Referral service is temporarily unavailable.' }, { status });
  }
}
