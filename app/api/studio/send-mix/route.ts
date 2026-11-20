import { NextResponse } from 'next/server';
import { createSupabaseServiceClient, verifyTelegramInitData } from '@/lib/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 4 * 1024 * 1024;
const TARGET_GROUP = '@Streetlifestars';

export async function POST(request: Request) {
  try {
    const initData = request.headers.get('x-telegram-init-data') || '';
    const user = verifyTelegramInitData(initData);

    const form = await request.formData();
    const mediaType = String(form.get('mediaType') || 'audio');
    const isVideo = mediaType === 'video';
    const media = form.get(isVideo ? 'video' : 'audio');
    const beatName = String(form.get('beatName') || 'STREET LIFE freestyle').slice(0, 100);
    const producer = String(form.get('producer') || '').slice(0, 100);
    const duration = Number(form.get('durationSeconds') || 0);

    if (!(media instanceof File)) {
      return NextResponse.json({ success: false, error: 'Recording file is missing.' }, { status: 400 });
    }
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES;
    if (!media.size || media.size > maxBytes) {
      return NextResponse.json({
        success: false,
        error: isVideo
          ? 'Video must be smaller than 4 MB. Please record a shorter video and try again.'
          : 'Recording must be between 1 byte and 4 MB. Please record again; Studio now compresses audio for upload.'
      }, { status: 413 });
    }
    if (isVideo ? !media.type.startsWith('video/') : !media.type.startsWith('audio/')) {
      return NextResponse.json({ success: false, error: 'Unsupported recording format.' }, { status: 415 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('STUDIO_SEND_MIX: TELEGRAM_BOT_TOKEN is not configured.');
      return NextResponse.json({ success: false, error: 'Studio upload is not configured. Please contact the administrator.' }, { status: 503 });
    }

    const caption = [
      isVideo ? '📹 STREET LIFE STUDIO — NEW VIDEO FREESTYLE' : '🎙️ STREET LIFE STUDIO — NEW MIX',
      `👤 Player ID: ${user.id}`,
      `🎵 Beat: ${beatName}`,
      producer ? `🎧 Producer: ${producer}` : '',
      Number.isFinite(duration) && duration > 0 ? `⏱️ Duration: ${Math.min(180, Math.floor(duration))} seconds` : '',
    ].filter(Boolean).join('\n');

    const telegramForm = new FormData();
    telegramForm.set('chat_id', TARGET_GROUP);
    telegramForm.set('caption', caption);
    telegramForm.set(isVideo ? 'video' : 'audio', media, media.name || (isVideo ? 'street-life-freestyle.webm' : 'street-life-mix.webm'));

    let telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/${isVideo ? 'sendVideo' : 'sendAudio'}`, {
      method: 'POST',
      body: telegramForm,
      cache: 'no-store',
    });
    let telegramResult = await telegramResponse.json().catch(() => null);

    // Telegram's playable-video endpoint prefers MPEG-4. If a browser records
    // WebM, preserve the recording and still deliver it to the group as a file.
    if (isVideo && (!telegramResponse.ok || !telegramResult?.ok)) {
      const documentForm = new FormData();
      documentForm.set('chat_id', TARGET_GROUP);
      documentForm.set('caption', caption);
      documentForm.set('document', media, media.name || 'street-life-freestyle.webm');
      telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
        method: 'POST',
        body: documentForm,
        cache: 'no-store',
      });
      telegramResult = await telegramResponse.json().catch(() => null);
    }

    if (!telegramResponse.ok || !telegramResult?.ok) {
      console.error('STUDIO_SEND_MIX Telegram API failure:', {
        status: telegramResponse.status,
        errorCode: telegramResult?.error_code,
        description: telegramResult?.description,
      });
      return NextResponse.json({
        success: false,
        error: 'Telegram could not post your mix. Please try again or contact the administrator.',
      }, { status: 502 });
    }

    // Count only after Telegram confirms that the audio was actually posted.
    // The service-role client keeps this tracking table private from players.
    try {
      const supabase = createSupabaseServiceClient();
      const { error } = await supabase.from('studio_group_song_posts').upsert({
        chat_id: String(telegramResult.result?.chat?.id ?? TARGET_GROUP),
        telegram_message_id: Number(telegramResult.result?.message_id),
        telegram_user_id: user.id,
        username: user.username || null,
        beat_name: beatName,
        producer: producer || null,
        duration_seconds: Number.isFinite(duration) && duration > 0 ? Math.min(180, Math.floor(duration)) : null,
      }, { onConflict: 'chat_id,telegram_message_id', ignoreDuplicates: true });

      if (error) {
        console.error('STUDIO_SEND_MIX song-count tracking failed:', error.message);
      }
    } catch (trackingError) {
      console.error('STUDIO_SEND_MIX song-count tracking exception:', trackingError);
    }

    return NextResponse.json({
      success: true,
      messageId: telegramResult.result?.message_id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send mix.';
    const status = /initData|Telegram verification|session expired|Missing Telegram/i.test(message) ? 401 : 500;
    console.error('STUDIO_SEND_MIX error:', message);
    return NextResponse.json({ success: false, error: status === 401 ? 'Telegram session expired. Reopen STREET LIFE from the bot and try again.' : 'Unable to send your mix right now.' }, { status });
  }
}
