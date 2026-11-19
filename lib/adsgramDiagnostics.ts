import { getTelegramInitData } from '@/lib/telegram';

export type AdsgramDiagnosticEvent =
  | 'ad_requested'
  | 'sdk_loaded'
  | 'controller_initialized'
  | 'ad_started'
  | 'ad_completed'
  | 'ad_failed'
  | 'reward_granted';

const BLOCK_ID = '59485';
const SESSION_ID = createId();

function createId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // RFC 4122-shaped fallback for older embedded Telegram webviews.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const random = Math.floor(Math.random() * 16);
      return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
    });
  }
}

/**
 * Best-effort diagnostic telemetry. It never controls ad playback or rewards.
 * The server independently verifies Telegram initData before saving events.
 */
export function recordAdsgramDiagnostic(
  eventType: AdsgramDiagnosticEvent,
  details: {
    sdkState?: string;
    done?: boolean;
    error?: boolean;
    description?: string;
    elapsedMs?: number;
  } = {}
): void {
  if (typeof window === 'undefined') return;

  const initData = getTelegramInitData();
  if (!initData) {
    console.warn('[STREET LIFE Adsgram] Diagnostic not sent: Telegram initData unavailable.', eventType);
    return;
  }

  const payload = {
    eventId: createId(),
    sessionId: SESSION_ID,
    blockId: BLOCK_ID,
    eventType,
    sdkState: details.sdkState,
    done: details.done,
    error: details.error,
    description: details.description?.slice(0, 240),
    elapsedMs: Number.isFinite(details.elapsedMs)
      ? Math.max(0, Math.min(600000, Math.round(details.elapsedMs!)))
      : undefined,
  };

  void fetch('/api/adsgram-diagnostics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-init-data': initData,
    },
    body: JSON.stringify(payload),
    keepalive: true,
    cache: 'no-store',
  }).then(async (response) => {
    if (!response.ok) {
      console.warn('[STREET LIFE Adsgram] Diagnostic endpoint rejected event:', response.status);
    }
  }).catch((error) => {
    console.warn('[STREET LIFE Adsgram] Could not send diagnostic event:', error);
  });
}
