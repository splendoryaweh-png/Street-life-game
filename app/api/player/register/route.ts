import { NextResponse } from 'next/server';
import {
  createSupabaseServiceClient,
  verifyTelegramInitData,
} from '@/lib/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Create the player's database row from Telegram's signed Mini App identity.
 * Existing balances and player progress are never overwritten on re-open.
 */
export async function POST(request: Request) {
  try {
    const initData = request.headers.get('x-telegram-init-data') || '';
    const user = verifyTelegramInitData(initData);
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
      .from('players')
      .upsert(
        {
          telegram_id: String(user.id),
          username: user.username || null,
          first_name: user.first_name || null,
          last_name: user.last_name || null,
          photo_url: user.photo_url || null,
          coins: 1000,
        },
        { onConflict: 'telegram_id', ignoreDuplicates: true }
      )
      .select('telegram_id')
      .maybeSingle();

    if (error) {
      console.error('Telegram player registration failed:', error);
      return NextResponse.json(
        { ok: false, error: 'Could not register your player account. Please reopen the game and try again.' },
        { status: 500 }
      );
    }

    // ignoreDuplicates may return no row for an existing account; confirm it exists.
    if (!data) {
      const { data: existing, error: lookupError } = await supabase
        .from('players')
        .select('telegram_id')
        .eq('telegram_id', String(user.id))
        .maybeSingle();

      if (lookupError || !existing) {
        console.error('Telegram player registration confirmation failed:', lookupError);
        return NextResponse.json(
          { ok: false, error: 'Player account could not be confirmed. Please try again.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { ok: true, registered: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Player registration failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}
