
import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type VerifiedTelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function verifyTelegramInitData(
  initData: string,
  maxAgeSeconds = 60 * 60 * 24
): VerifiedTelegramUser {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error('Server configuration missing TELEGRAM_BOT_TOKEN.');
  if (!initData || typeof initData !== 'string') throw new Error('Missing Telegram initData.');

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) throw new Error('Invalid Telegram initData signature.');

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (!safeEqualHex(calculatedHash, receivedHash)) {
    throw new Error('Telegram verification failed. Reopen the game from the Telegram bot.');
  }

  const authDate = Number(params.get('auth_date') || 0);
  const now = Math.floor(Date.now() / 1000);

  if (!authDate || authDate > now + 60 || now - authDate > maxAgeSeconds) {
    throw new Error('Telegram session expired. Reopen the game from the Telegram bot.');
  }

  const rawUser = params.get('user');
  if (!rawUser) throw new Error('Telegram user information is missing.');

  let user: VerifiedTelegramUser;

  try {
    user = JSON.parse(rawUser) as VerifiedTelegramUser;
  } catch {
    throw new Error('Telegram user information is invalid.');
  }

  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) {
    throw new Error('Telegram user ID is invalid.');
  }

  return user;
}

export function createSupabaseServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Server configuration missing Supabase URL or service key.');
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function isStreetLifeAdmin(telegramId: number | string): boolean {
  const configured =
    process.env.STREETLIFE_ADMIN_TELEGRAM_IDS ||
    process.env.ADMIN_TELEGRAM_IDS ||
    '';

  const allowed = configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return allowed.includes(String(telegramId));
}
