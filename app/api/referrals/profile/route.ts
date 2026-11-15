import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createSupabaseServiceClient, verifyTelegramInitData } from '@/lib/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const initData = request.headers.get('x-telegram-init-data') || '';
    const user = verifyTelegramInitData(initData);
    const supabase = createSupabaseServiceClient();

    const { error: upsertError } = await supabase.from('players').upsert({
      telegram_id: user.id,
      username: user.username ?? null,
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
      photo_url: user.photo_url ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'telegram_id', ignoreDuplicates: false });
    if (upsertError) throw upsertError;

    let player: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase.from('players')
        .select('referral_code,referred_by,referred_by_code,coins')
        .eq('telegram_id', user.id).single();
      if (error) throw error;
      player = data;
      if (player.referral_code?.trim()) break;
      const code = 'SL' + randomBytes(5).toString('hex').slice(0, 7).toUpperCase();
      const { error: updateError } = await supabase.from('players')
        .update({ referral_code: code, updated_at: new Date().toISOString() })
        .eq('telegram_id', user.id)
        .or('referral_code.is.null,referral_code.eq.');
      if (updateError && !/duplicate key/i.test(updateError.message)) throw updateError;
    }
    if (!player?.referral_code) {
      const { data, error } = await supabase.from('players')
        .select('referral_code,referred_by,referred_by_code,coins')
        .eq('telegram_id', user.id).single();
      if (error) throw error;
      player = data;
    }
    if (!player?.referral_code) throw new Error('Could not assign a unique referral code.');

    const { count, error: countError } = await supabase.from('players')
      .select('telegram_id', { count: 'exact', head: true })
      .eq('referred_by', String(user.id));
    if (countError) throw countError;

    return NextResponse.json({
      referralCode: player.referral_code,
      referralsCount: count || 0,
      hasClaimedWelcomeBonus: Boolean(player.referred_by || player.referred_by_code),
      appliedReferralCode: player.referred_by_code || null,
      coins: Number(player.coins || 0),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Referral profile failed:', error);
    const message = error instanceof Error ? error.message : 'Unable to load referral profile.';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
