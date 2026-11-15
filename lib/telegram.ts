import { TelegramUser } from '@/types/game';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close?: () => void;
        /** Original Telegram-signed WebApp init data; send unchanged to the server for verification. */
        initData?: string;
        initDataUnsafe?: {
          user?: TelegramUser;
        };
        themeParams?: Record<string, string>;
        colorScheme?: 'light' | 'dark';
        isExpanded?: boolean;
      };
    };
  }
}

// ============================================================================
// OFFICIAL STREET LIFE BOT
// ============================================================================

export const STREET_LIFE_BOT_USERNAME = 'Streetlifebot_bot';
export const STREET_LIFE_BOT_URL = `https://t.me/${STREET_LIFE_BOT_USERNAME}`;

/**
 * Returns Telegram's original signed initData string.
 * Do not construct, edit, or trust client-decoded identity data for server auth.
 * The server must validate this exact string using the bot token.
 */
export function getTelegramInitData(): string {
  if (typeof window === 'undefined') return '';

  try {
    return window.Telegram?.WebApp?.initData || '';
  } catch (err) {
    console.warn('Unable to read Telegram initData:', err);
    return '';
  }
}

/** Returns the currently available Telegram WebApp user snapshot. */
export function getTelegramUser(): TelegramUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!user || user.id === undefined || user.id === null) return null;
    return user;
  } catch (err) {
    console.warn('Unable to read Telegram WebApp user:', err);
    return null;
  }
}

export function initTelegramWebApp(): TelegramUser | null {
  if (typeof window === 'undefined') return null;

  try {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();
    return getTelegramUser();
  } catch (err) {
    console.warn('Telegram WebApp safe initialization notice:', err);
  }

  return null;
}

// ============================================================================
// TELEGRAM OFFICIAL CHANNELS & CONSTANTS
// ============================================================================

export const TELEGRAM_OFFICIAL_CHANNELS = {
  mainChannel: {
    id: '-100234891238',
    name: 'STREET LIFE Main Channel',
    url: 'https://t.me/Streethustlegame2',
    username: 'Streethustlegame2',
  },
  chatGroup: {
    id: '-100235918239',
    name: 'STREET LIFE Chat Room',
    url: 'https://t.me/Streethustlechatroom',
    username: 'Streethustlechatroom',
  },
  paymentProof: {
    id: '-100249102938',
    name: 'STREET LIFE Payment Proof',
    url: 'https://t.me/Streethustlepaymentproof',
    username: 'Streethustlepaymentproof',
  },
};

// ============================================================================
// TELEGRAM BOOST VERIFICATION — FAIL CLOSED UNTIL SERVER BOT API IS CONFIGURED
// ============================================================================

export interface TelegramChatBoost {
  boost_id: string;
  add_date: number;
  expiration_date: number;
  source: {
    source: 'premium' | 'gift' | 'giveaway';
    user: { id: number | string; is_bot: boolean; first_name: string; username?: string };
  };
}

export interface TelegramBoostValidationResult {
  hasBoosted: boolean;
  userId: string;
  username?: string;
  channelName: string;
  channelUrl: string;
  channelId: string;
  boostCount: number;
  boosts: TelegramChatBoost[];
  verificationTimestamp: number;
  apiMethod: 'getUserChatBoosts';
  statusCode: 200 | 404 | 400;
  statusMessage: string;
}

/**
 * Never trust browser storage, seeded usernames, or fabricated boost objects as proof.
 * Until a server-side Telegram Bot API verifier is configured, this safely reports
 * that verification is unavailable rather than granting a boost reward.
 */
export async function validateTelegramChannelBoost(
  userIdOrUsername: string | number,
  channelIdentifier: string
): Promise<TelegramBoostValidationResult> {
  const cleanChannel = String(channelIdentifier || '').toLowerCase();
  const targetChannel =
    cleanChannel.includes('proof') || cleanChannel.includes('payment') || cleanChannel.includes('100249102938')
      ? TELEGRAM_OFFICIAL_CHANNELS.paymentProof
      : TELEGRAM_OFFICIAL_CHANNELS.mainChannel;

  return {
    hasBoosted: false,
    userId: String(userIdOrUsername),
    channelName: targetChannel.name,
    channelUrl: targetChannel.url,
    channelId: targetChannel.id,
    boostCount: 0,
    boosts: [],
    verificationTimestamp: Date.now(),
    apiMethod: 'getUserChatBoosts',
    statusCode: 400,
    statusMessage: 'Live Telegram boost verification is not configured. No reward can be approved from this check.',
  };
}

/** Browser-side boost claims are disabled; only a trusted server verifier may record them. */
export function recordSimulatedUserBoost(
  _userIdOrUsername: string | number,
  _channelType: 'main' | 'proof'
): void {
  console.warn('Simulated Telegram boost recording is disabled.');
}

// ============================================================================
// AUTOMATED TELEGRAM BOT NOTIFICATION SERVICE
// ============================================================================

export type BotNotificationType =
  | 'task_approved'
  | 'task_rejected'
  | 'boost_verified'
  | 'status_post_approved'
  | 'video_promo_approved'
  | 'withdrawal_processed';

export interface BotNotification {
  id: string;
  recipientId: string;
  recipientUsername?: string;
  type: BotNotificationType;
  title: string;
  message: string;
  telegramMarkdown: string;
  reward?: number;
  timestamp: number;
  delivered: boolean;
  read: boolean;
  botName: string;
  botUsername: string;
}

const STORAGE_NOTIFICATIONS_KEY = 'streetLife_bot_notifications';

export async function sendAutomatedBotNotification(params: {
  recipientId: string;
  recipientUsername?: string;
  type: BotNotificationType;
  title: string;
  message: string;
  reward?: number;
  channelName?: string;
  rejectReason?: string;
}): Promise<{ success: boolean; notification: BotNotification }> {
  const {
    recipientId,
    recipientUsername,
    type,
    title,
    message,
    reward,
    rejectReason,
  } = params;

  const userTag = recipientUsername
    ? recipientUsername.startsWith('@')
      ? recipientUsername
      : `@${recipientUsername}`
    : `ID: ${recipientId}`;

  const isApproved = type !== 'task_rejected';

  const telegramMarkdown = [
    `🤖 *STREET LIFE NOTIFICATION BOT*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 *User:* ${userTag}`,
    `${isApproved ? '✅' : '❌'} *Status:* ${title}`,
    ``,
    `📝 *Details:* ${message}`,
    reward
      ? `💰 *Reward Credited:* +${reward.toLocaleString()} StreetCoins (SC)`
      : '',
    rejectReason
      ? `⚠️ *Rejection Reason:* ${rejectReason}`
      : '',
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🎮 *Launch Game:* ${STREET_LIFE_BOT_URL}`,
    `📢 *Official Channel:* @Streethustlegame2`,
  ]
    .filter(Boolean)
    .join('\n');

  const notification: BotNotification = {
    id: `bot_msg_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}`,
    recipientId,
    recipientUsername: userTag,
    type,
    title,
    message,
    telegramMarkdown,
    reward,
    timestamp: Date.now(),
    delivered: true,
    read: false,
    botName: 'Street Life Hustle Bot',
    botUsername: '@Streetlifebot_bot',
  };

  if (typeof window !== 'undefined') {
    try {
      const existingRaw = localStorage.getItem(
        STORAGE_NOTIFICATIONS_KEY
      );

      const list: BotNotification[] = existingRaw
        ? JSON.parse(existingRaw)
        : [];

      const updatedList = [notification, ...list].slice(0, 50);

      localStorage.setItem(
        STORAGE_NOTIFICATIONS_KEY,
        JSON.stringify(updatedList)
      );

      window.dispatchEvent(
        new CustomEvent('streetlife_bot_notification', {
          detail: notification,
        })
      );
    } catch (err) {
      console.error('Error saving bot notification:', err);
    }
  }

  return { success: true, notification };
}

// ============================================================================
// RETRIEVE BOT NOTIFICATIONS
// ============================================================================

export function getBotNotifications(
  recipientId?: string
): BotNotification[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_NOTIFICATIONS_KEY);
    if (!raw) return [];

    const list: BotNotification[] = JSON.parse(raw);

    if (recipientId) {
      const clean = recipientId
        .trim()
        .toLowerCase()
        .replace(/^@/, '');

      return list.filter(
        (n) =>
          n.recipientId.toLowerCase().includes(clean) ||
          n.recipientUsername?.toLowerCase().includes(clean)
      );
    }

    return list;
  } catch {
    return [];
  }
}

// ============================================================================
// MARK A BOT NOTIFICATION AS READ
// ============================================================================

export function markBotNotificationAsRead(id: string): void {
  if (typeof window === 'undefined') return;

  try {
    const raw = localStorage.getItem(STORAGE_NOTIFICATIONS_KEY);
    if (!raw) return;

    const list: BotNotification[] = JSON.parse(raw);

    const updated = list.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );

    localStorage.setItem(
      STORAGE_NOTIFICATIONS_KEY,
      JSON.stringify(updated)
    );
  } catch {}
}

// ============================================================================
// CLEAR ALL STORED BOT NOTIFICATIONS
// ============================================================================

export function clearAllBotNotifications(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_NOTIFICATIONS_KEY);
  } catch {}
}
