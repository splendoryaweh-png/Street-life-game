
'use client';

export interface PendingTaskItem {
  id: string;
  playerId: string;
  playerUsername: string;
  type: 'status_post' | 'boost' | 'video' | 'social';
  subType?: 'whatsapp' | 'telegram' | 'tiktok' | 'youtube';
  status: 'pending' | 'approved' | 'denied';
  reward: number;
  proofUrl?: string;
  screenshot1?: string;
  screenshot2?: string;
  stats?: {
    likes: number;
    views: number;
    hasHashtag: boolean;
  };
  submittedAt: number;
  date: string;
  denialReason?: string;
  approvedAt?: number;
  taskKey?: string;
  platform?: string;
}

const STORAGE_COMPLETED_TASKS = 'street_tasks_completed';
const STORAGE_ADS_WATCHED = 'ads_watched_count';
const STORAGE_ADS_CLAIMED = 'ads_task_claimed_v2';
const STORAGE_GLOBAL_USED_LINKS = 'street_tasks_used_links';

function getTelegramInitData(): string {
  if (typeof window === 'undefined') return '';

  return (
    (window as any).Telegram?.WebApp?.initData ||
    ''
  );
}

function normalizeSubmission(row: any): PendingTaskItem {
  const submittedAt = row.submitted_at
    ? new Date(row.submitted_at).getTime()
    : Date.now();

  const status =
    row.status === 'approved'
      ? 'approved'
      : row.status === 'rejected' || row.status === 'denied'
        ? 'denied'
        : 'pending';

  const screenshots = Array.isArray(row.screenshot_urls)
    ? row.screenshot_urls
    : [];

  return {
    id: String(row.id),
    playerId: String(row.player_telegram_id || ''),
    playerUsername: String(row.player_username || 'Player'),
    type: row.task_type === 'status_post' ||
      row.task_type === 'boost' ||
      row.task_type === 'video'
        ? row.task_type
        : 'social',
    status,
    reward: Number(row.reward || 0),
    proofUrl: row.proof_url || undefined,
    screenshot1: screenshots[0] || undefined,
    screenshot2: screenshots[1] || undefined,
    submittedAt,
    date: new Date(submittedAt).toISOString().slice(0, 10),
    denialReason: row.denial_reason || undefined,
    taskKey: row.task_key || undefined,
    platform: row.platform || undefined,
    subType: String(row.platform || '').toLowerCase().includes('youtube')
      ? 'youtube'
      : String(row.platform || '').toLowerCase().includes('tiktok')
        ? 'tiktok'
        : String(row.platform || '').toLowerCase().includes('whatsapp')
          ? 'whatsapp'
          : String(row.platform || '').toLowerCase().includes('telegram')
            ? 'telegram'
            : undefined,
  };
}

/**
 * Pending task records are now loaded from the server.
 * This function intentionally returns an empty array so old
 * localStorage sample submissions cannot appear as real submissions.
 */
export function getPendingTasks(): PendingTaskItem[] {
  return [];
}

/**
 * Local task lists are no longer accepted as an approval source.
 * Keep this export temporarily for compatibility with older imports.
 */
export function savePendingTasks(_tasks: PendingTaskItem[]): void {
  // Intentionally disabled. Server records are authoritative.
}

/**
 * Load real task submissions from the secured server.
 * The server verifies Telegram initData before returning records.
 */
export async function loadPendingTasksFromServer(
  admin = false
): Promise<PendingTaskItem[]> {
  const initData = getTelegramInitData();

  if (!initData) {
    throw new Error('Open STREET LIFE inside Telegram before loading tasks.');
  }

  const endpoint = admin ? '/api/admin/tasks' : '/api/tasks';

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'x-telegram-init-data': initData,
    },
    cache: 'no-store',
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || 'Could not load task submissions.');
  }

  const submissions = Array.isArray(result.submissions)
    ? result.submissions
    : [];

  return submissions.map(normalizeSubmission);
}

/**
 * Link tracking is retained only as a convenience for the interface.
 * It is NOT security verification and must never be used to award coins.
 */
export function getUsedLinks(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_GLOBAL_USED_LINKS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordUsedLink(link: string): void {
  if (typeof window === 'undefined' || !link) return;

  try {
    const normalized = link.trim().toLowerCase();
    const links = getUsedLinks();

    if (!links.includes(normalized)) {
      links.push(normalized);
      localStorage.setItem(
        STORAGE_GLOBAL_USED_LINKS,
        JSON.stringify(links)
      );
    }
  } catch (error) {
    console.error('Could not record task link:', error);
  }
}

export function isLinkAlreadyUsed(link: string): boolean {
  if (!link || typeof window === 'undefined') return false;

  return getUsedLinks().includes(link.trim().toLowerCase());
}

/**
 * Local completion flags are display-only.
 * They do not prove that a task was completed.
 */
export function getCompletedTasks(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem(STORAGE_COMPLETED_TASKS);
    const parsed = raw ? JSON.parse(raw) : {};

    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * IMPORTANT:
 * This function no longer credits coins.
 * Social task completion must be confirmed by the server.
 */
export function markTaskCompleted(
  _taskId: string,
  _reward = 50,
  _taskName = 'Social Task'
): boolean {
  console.warn(
    'Local task rewards are disabled. Use the server task verification endpoint.'
  );

  return false;
}

/**
 * Ad counters are display-only.
 * A browser counter cannot prove that an advert was watched.
 */
export function getAdsWatchedCount(): number {
  if (typeof window === 'undefined') return 0;

  try {
    const value = Number(localStorage.getItem(STORAGE_ADS_WATCHED) || 0);
    return Number.isFinite(value)
      ? Math.min(30, Math.max(0, value))
      : 0;
  } catch {
    return 0;
  }
}

export function incrementAdsWatched(): number {
  if (typeof window === 'undefined') return 0;

  const next = Math.min(30, getAdsWatchedCount() + 1);

  try {
    localStorage.setItem(STORAGE_ADS_WATCHED, String(next));
    window.dispatchEvent(
      new CustomEvent('streetlife_ads_watched_changed', {
        detail: next,
      })
    );
  } catch (error) {
    console.error('Could not update ad counter:', error);
  }

  return next;
}

export function isAdsTaskClaimed(): boolean {
  if (typeof window === 'undefined') return false;

  return localStorage.getItem(STORAGE_ADS_CLAIMED) === 'true';
}

/**
 * A local ad counter must never trigger a coin reward.
 */
export function claimAdsTaskReward(): boolean {
  console.warn(
    'Ad rewards cannot be claimed from a local browser counter.'
  );

  return false;
}

/**
 * This local count is informational only.
 * The server enforces actual daily submission limits.
 */
export function getDailyTaskSubmissionCount(
  _type: 'status_post' | 'boost',
  _dateStr = new Date().toISOString().slice(0, 10)
): number {
  return 0;
}

/**
 * Validate video URL format only.
 * Do not fabricate likes, views, hashtags or verification results.
 */
export function simulateAutoCheckVideo(url: string): {
  validUrl: boolean;
  qualified: boolean;
  likes: number;
  views: number;
  hasHashtag: boolean;
  message: string;
} {
  let validUrl = false;

  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();

    validUrl =
      parsed.protocol === 'https:' &&
      (
        host === 'youtube.com' ||
        host.endsWith('.youtube.com') ||
        host === 'youtu.be' ||
        host === 'tiktok.com' ||
        host.endsWith('.tiktok.com')
      );
  } catch {
    validUrl = false;
  }

  return {
    validUrl,
    qualified: false,
    likes: 0,
    views: 0,
    hasHashtag: false,
    message: validUrl
      ? 'Link format accepted. Actual performance and eligibility require verification.'
      : 'Enter a valid HTTPS TikTok or YouTube video link.',
  };
}

/**
 * Admin approval is performed on the server.
 * The server checks Telegram identity and admin permissions,
 * then credits the actual player's account through the database.
 */
export async function approveTask(
  taskId: string
): Promise<{
  success: boolean;
  reward: number;
  message: string;
}> {
  const initData = getTelegramInitData();

  if (!initData) {
    return {
      success: false,
      reward: 0,
      message: 'Open STREET LIFE inside Telegram first.',
    };
  }

  try {
    const response = await fetch('/api/admin/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initData,
        submissionId: taskId,
        action: 'approve',
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        reward: 0,
        message: result.error || 'Task approval failed.',
      };
    }

    return {
      success: true,
      reward: Number(result.credited || 0),
      message: result.message || 'Task approved successfully.',
    };
  } catch (error) {
    console.error('Task approval error:', error);

    return {
      success: false,
      reward: 0,
      message: 'Network error. The task was not approved.',
    };
  }
}

/**
 * Rejection is also performed on the secured server.
 */
export async function denyTask(
  taskId: string,
  reason = 'Proof does not meet verification requirements.'
): Promise<{
  success: boolean;
  message: string;
}> {
  const initData = getTelegramInitData();

  if (!initData) {
    return {
      success: false,
      message: 'Open STREET LIFE inside Telegram first.',
    };
  }

  try {
    const response = await fetch('/api/admin/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initData,
        submissionId: taskId,
        action: 'reject',
        reason,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        message: result.error || 'Task rejection failed.',
      };
    }

    return {
      success: true,
      message: result.message || 'Task rejected.',
    };
  } catch (error) {
    console.error('Task rejection error:', error);

    return {
      success: false,
      message: 'Network error. The task was not rejected.',
    };
  }
}
