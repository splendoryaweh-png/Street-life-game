import { NextResponse } from 'next/server';
import { verifyTelegramInitData } from '@/lib/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function safeFileName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 100) || 'street-life-mix.webm';
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const initData = form.get('initData');
    const file = form.get('file');
    const beatNameRaw = form.get('beatName');
    const durationRaw = form.get('durationSec');

    if (typeof initData !== 'string' || !initData) {
      return NextResponse.json({ error: 'Open STREET LIFE inside Telegram before posting a mix.' }, { status: 401 });
    }

    const user = verifyTelegramInitData(initData, 600);
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'The recorded mix file is missing.' }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'The mix must be between 1 byte and 4 MB. Please shorten the recording and try again.' }, { status: 413 });
    }

    const mimeType = file.type || 'application/octet-stream';
    if (!mimeType.startsWith('audio/')) {
      return NextResponse.json({ error: 'Only audio recordings can be posted from this button.' }, { status: 415 });
    }

    const beatName = typeof beatNameRaw === 'string'
      ? beatNameRaw.trim().slice(0, 80)
      : 'Street Life Studio Mix';
    const durationSec = Number(durationRaw);
    const duration = Number.isSafeInteger(durationSec) && durationSec > 0 && durationSec <= 180
      ? durationSec
      : undefined;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const targetChat = process.env.STREETLIFE_STUDIO_GROUP_ID || '@Streetlifestars';
    if (!botToken) {
      return NextResponse.json({ error: 'Studio posting is not configured on the server.' }, { status: 503 });
    }

    const username = typeof user.username === 'string' && user.username
      ? `@${user.username}`
      : user.first_name || 'STREET LIFE creator';
    const caption = `🎙️ STREET LIFE STUDIO MIX\n🎵 ${beatName}\n👤 ${username}`;

    const extension = file.name.includes('.')
      ? file.name.slice(file.name.lastIndexOf('.')).replace(/[^.a-zA-Z0-9]/g, '').slice(0, 10)
      : '.webm';
    const uploadName = safeFileName(`StreetLife-${beatName.replace(/\\s+/g, '-')}-${Date.now()}${extension}`);

    // WebM/other browser-native formats are sent as documents so Telegram
    // accepts the exact recorded bytes without transcoding or corruption.
    const method = mimeType === 'audio/mpeg' || mimeType === 'audio/mp4'
      ? 'sendAudio'
      : 'sendDocument';
    const mediaField = method === 'sendAudio' ? 'audio' : 'document';

    const telegramForm = new FormData();
    telegramForm.append('chat_id', targetChat);
    telegramForm.append(mediaField, file, uploadName);
    telegramForm.append('caption', caption);
    if (duration !== undefined && method === 'sendAudio') {
      telegramForm.append('duration', String(duration));
      telegramForm.append('title', beatName);
      telegramForm.append('performer', 'STREET LIFE Studio');
    }

    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: 'POST',
      body: telegramForm,
      cache: 'no-store',
    });
    const telegramResult = await telegramResponse.json().catch(() => null);

    if (!telegramResponse.ok || telegramResult?.ok !== true) {
      console.error('Studio Telegram delivery failed:', telegramResult?.description || telegramResponse.status);
      return NextResponse.json({
        error: 'Telegram could not deliver the mix. Check that the STREET LIFE bot is an administrator in the @Streetlifestars group and can post messages.',
      }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      message: 'Your studio mix was sent to the STREET LIFE group.',
      messageId: telegramResult.result?.message_id ?? null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Studio mix posting failed:', error);
    const message = error instanceof Error ? error.message : 'Studio mix could not be sent.';
    const status = /Telegram session expired|Telegram verification failed|Missing Telegram initData|Invalid Telegram initData/i.test(message)
      ? 401
      : 500;
    return NextResponse.json({
      error: status === 401
        ? 'Your Telegram session expired. Reopen STREET LIFE and try again.'
        : 'The studio mix could not be sent. Please try again.',
    }, { status });
  }
}
