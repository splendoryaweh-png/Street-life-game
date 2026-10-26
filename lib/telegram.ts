import { TelegramUser } from '@/types/game';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close?: () => void;
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

export function initTelegramWebApp(): TelegramUser | null {
  if (typeof window === 'undefined') return null;

  try {
    window?.Telegram?.WebApp?.ready?.();
    window?.Telegram?.WebApp?.expand?.();
    if (window?.Telegram?.WebApp?.initDataUnsafe?.user) {
      return window.Telegram.WebApp.initDataUnsafe.user;
    }
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
// SIMULATED TELEGRAM API: USER CHAT BOOST VALIDATION
// (Modeled after Telegram Bot API getUserChatBoosts endpoint)
// ============================================================================

export interface TelegramChatBoost {
  boost_id: string;
  add_date: number; // Unix timestamp
  expiration_date: number; // Unix timestamp
  source: {
    source: 'premium' | 'gift' | 'giveaway';
    user: {
      id: number | string;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
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

// Seeded list of users who have verified active channel boosts
const DEFAULT_ACTIVE_BOOSTERS: Record<string, { mainChannel?: boolean; paymentProof?: boolean }> = {
  '10293847': { mainChannel: true, paymentProof: true },
  '@ton_whale_vip': { mainChannel: true, paymentProof: true },
  'ton_whale_vip': { mainChannel: true, paymentProof: true },
  '11223344': { mainChannel: true, paymentProof: false },
  '@street_boss_og': { mainChannel: true, paymentProof: false },
  'street_boss_og': { mainChannel: true, paymentProof: false },
  'SL-DEV-001': { mainChannel: true, paymentProof: true },
  '@streetlife737': { mainChannel: true, paymentProof: true },
  'streetlife737': { mainChannel: true, paymentProof: true },
};

/**
 * Validates whether a user has actually performed a 'boost' on the specified Telegram channel.
 * Simulates Telegram Bot API getUserChatBoosts endpoint (https://core.telegram.org/bots/api#getuserchatboosts)
 *
 * @param userIdOrUsername Telegram User ID or @username
 * @param channelIdentifier Channel URL, ID, or key ('Main Channel' | 'Payment Proof' | url)
 * @returns Promise<TelegramBoostValidationResult> with boolean `hasBoosted` status
 */
export async function validateTelegramChannelBoost(
  userIdOrUsername: string | number,
  channelIdentifier: string
): Promise<TelegramBoostValidationResult> {
  const cleanUser = String(userIdOrUsername).trim().toLowerCase();
  const cleanChannel = channelIdentifier.trim().toLowerCase();

  // Determine target channel
  let targetChannel = TELEGRAM_OFFICIAL_CHANNELS.mainChannel;
  if (
    cleanChannel.includes('proof') ||
    cleanChannel.includes('payment') ||
    cleanChannel.includes('100249102938')
  ) {
    targetChannel = TELEGRAM_OFFICIAL_CHANNELS.paymentProof;
  }

  // Artificial network roundtrip delay (simulate Telegram Bot API)
  await new Promise((resolve) => setTimeout(resolve, 600));

  // Check persistent localStorage for dynamic user boosts
  let dynamicBoosters: Record<string, { mainChannel?: boolean; paymentProof?: boolean }> = {};
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('streetLife_channel_boosters');
      if (stored) {
        dynamicBoosters = JSON.parse(stored);
      }
    } catch {}
  }

  const isMain = targetChannel === TELEGRAM_OFFICIAL_CHANNELS.mainChannel;
  const userKey = cleanUser.replace(/^@/, '');

  // Check if user has active boost
  const seeded = DEFAULT_ACTIVE_BOOSTERS[cleanUser] || DEFAULT_ACTIVE_BOOSTERS[userKey];
  const dynamic = dynamicBoosters[cleanUser] || dynamicBoosters[userKey];

  const hasBoosted = Boolean(
    (isMain && (seeded?.mainChannel || dynamic?.mainChannel)) ||
    (!isMain && (seeded?.paymentProof || dynamic?.paymentProof))
  );

  const now = Date.now();
  const oneMonthMs = 30 * 24 * 60 * 60 * 1000;

  if (hasBoosted) {
    const boostData: TelegramChatBoost = {
      boost_id: `bst_${Math.random().toString(36).substring(2, 8)}`,
      add_date: Math.floor((now - 1000 * 60 * 60 * 24 * 3) / 1000),
      expiration_date: Math.floor((now + oneMonthMs) / 1000),
      source: {
        source: 'premium',
        user: {
          id: cleanUser,
          is_bot: false,
          first_name: cleanUser.startsWith('@') ? cleanUser.slice(1) : cleanUser,
          username: cleanUser.startsWith('@') ? cleanUser.slice(1) : undefined,
        },
      },
    };

    return {
      hasBoosted: true,
      userId: String(userIdOrUsername),
      username: cleanUser.startsWith('@') ? cleanUser : `@${cleanUser}`,
      channelName: targetChannel.name,
      channelUrl: targetChannel.url,
      channelId: targetChannel.id,
      boostCount: 1,
      boosts: [boostData],
      verificationTimestamp: now,
      apiMethod: 'getUserChatBoosts',
      statusCode: 200,
      statusMessage: `Active boost verified for ${targetChannel.name} (Telegram Bot API: 200 OK)`,
    };
  }

  // Not boosted
  return {
    hasBoosted: false,
    userId: String(userIdOrUsername),
    username: cleanUser.startsWith('@') ? cleanUser : `@${cleanUser}`,
    channelName: targetChannel.name,
    channelUrl: targetChannel.url,
    channelId: targetChannel.id,
    boostCount: 0,
    boosts: [],
    verificationTimestamp: now,
    apiMethod: 'getUserChatBoosts',
    statusCode: 404,
    statusMessage: `No active boost found on ${targetChannel.name} for user ${userIdOrUsername}`,
  };
}

/**
 * Record a user boost in the local simulation database (e.g. when user clicks Boost in game)
 */
export function recordSimulatedUserBoost(
  userIdOrUsername: string | number,
  channelType: 'main' | 'proof'
): void {
  if (typeof window === 'undefined') return;

  const key = String(userIdOrUsername).trim().toLowerCase().replace(/^@/, '');
  try {
    const raw = localStorage.getItem('streetLife_channel_boosters') || '{}';
    const data = JSON.parse(raw);
    if (!data[key]) data[key] = {};

    if (channelType === 'main') {
      data[key].mainChannel = true;
    } else {
      data[key].paymentProof = true;
    }

    localStorage.setItem('streetLife_channel_boosters', JSON.stringify(data));
  } catch (err) {
    console.error('Error saving user boost:', err);
  }
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

/**
 * Sends an automated notification from the official Street Life Telegram Bot.
 * Generates formatted Telegram markdown, stores the notification in localStorage,
 * and broadcasts an event so the in-game UI displays a live notification alert.
 */
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

  // Build authentic Telegram Markdown message
  const telegramMarkdown = [
    `🤖 *STREET LIFE NOTIFICATION BOT*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 *User:* ${userTag}`,
    `${isApproved ? '✅' : '❌'} *Status:* ${title}`,
    ``,
    `📝 *Details:* ${message}`,
    reward ? `💰 *Reward Credited:* +${reward.toLocaleString()} StreetCoins (SC)` : '',
    rejectReason ? `⚠️ *Rejection Reason:* ${rejectReason}` : '',
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🎮 *Launch Game:* https://t.me/Streethustlegame2`,
    `📢 *Official Channel:* @Streethustlegame2`,
  ]
    .filter(Boolean)
    .join('\n');

  const notification: BotNotification = {
    id: `bot_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
    botUsername: '@StreetLifeGameBot',
  };

  // Persist to localStorage
  if (typeof window !== 'undefined') {
    try {
      const existingRaw = localStorage.getItem(STORAGE_NOTIFICATIONS_KEY);
      const list: BotNotification[] = existingRaw ? JSON.parse(existingRaw) : [];
      const updatedList = [notification, ...list].slice(0, 50); // Keep last 50 notifications
      localStorage.setItem(STORAGE_NOTIFICATIONS_KEY, JSON.stringify(updatedList));

      // Dispatch real-time custom event for in-game notification toasts
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

/**
 * Retrieve all automated bot notifications from storage
 */
export function getBotNotifications(recipientId?: string): BotNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_NOTIFICATIONS_KEY);
    if (!raw) return [];
    const list: BotNotification[] = JSON.parse(raw);
    if (recipientId) {
      const clean = recipientId.trim().toLowerCase().replace(/^@/, '');
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

/**
 * Mark a bot notification as read
 */
export function markBotNotificationAsRead(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_NOTIFICATIONS_KEY);
    if (!raw) return;
    const list: BotNotification[] = JSON.parse(raw);
    const updated = list.map((n) => (n.id === id ? { ...n, read: true } : n));
    localStorage.setItem(STORAGE_NOTIFICATIONS_KEY, JSON.stringify(updated));
  } catch {}
}

/**
 * Clear all stored bot notifications
 */
export function clearAllBotNotifications(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_NOTIFICATIONS_KEY);
  } catch {}
}
