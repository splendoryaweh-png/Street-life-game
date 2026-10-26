'use client';

import { addGameCoins } from './storage';

export interface PendingTaskItem {
  id: string;
  playerId: string;
  playerUsername: string;
  type: 'status_post' | 'boost' | 'video';
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
}

const STORAGE_PENDING_TASKS = 'street_pending_tasks_v2';
const STORAGE_COMPLETED_TASKS = 'street_tasks_completed';
const STORAGE_ADS_WATCHED = 'ads_watched_count';
const STORAGE_ADS_CLAIMED = 'ads_task_claimed_v2';
const STORAGE_GLOBAL_USED_LINKS = 'street_tasks_used_links';

// Initial mock pending items so admin panel is populated out of the box
const INITIAL_PENDING_TASKS: PendingTaskItem[] = [
  {
    id: 'pt_init_1',
    playerId: 'usr_hustler_88',
    playerUsername: '@KingHustle_88',
    type: 'status_post',
    subType: 'whatsapp',
    status: 'pending',
    reward: 50,
    proofUrl: 'https://chat.whatsapp.com/status-proof-88',
    screenshot1: 'https://picsum.photos/seed/whatsapp1/600/900',
    screenshot2: 'https://picsum.photos/seed/whatsappviews1/600/900',
    submittedAt: Date.now() - 1000 * 60 * 35,
    date: new Date().toISOString().split('T')[0],
  },
  {
    id: 'pt_init_2',
    playerId: 'usr_boost_77',
    playerUsername: '@TonMaster77',
    type: 'boost',
    subType: 'telegram',
    status: 'pending',
    reward: 1000,
    proofUrl: 'https://t.me/Streethustlegame2',
    screenshot1: 'https://picsum.photos/seed/boostproof77/600/900',
    submittedAt: Date.now() - 1000 * 60 * 75,
    date: new Date().toISOString().split('T')[0],
  },
  {
    id: 'pt_init_3',
    playerId: 'usr_creator_99',
    playerUsername: '@VibeStreetSL',
    type: 'video',
    subType: 'tiktok',
    status: 'pending',
    reward: 2000,
    proofUrl: 'https://www.tiktok.com/@vibestreetsl/video/73918291029102',
    screenshot1: 'https://picsum.photos/seed/tiktokvid99/800/600',
    stats: {
      likes: 340,
      views: 3200,
      hasHashtag: true,
    },
    submittedAt: Date.now() - 1000 * 60 * 120,
    date: new Date().toISOString().split('T')[0],
  },
];

// Helper to get pending tasks
export function getPendingTasks(): PendingTaskItem[] {
  if (typeof window === 'undefined') return INITIAL_PENDING_TASKS;
  try {
    const raw = localStorage.getItem(STORAGE_PENDING_TASKS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading pending tasks:', e);
  }
  // Initialize with sample items
  try {
    localStorage.setItem(STORAGE_PENDING_TASKS, JSON.stringify(INITIAL_PENDING_TASKS));
  } catch {}
  return INITIAL_PENDING_TASKS;
}

export function savePendingTasks(tasks: PendingTaskItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PENDING_TASKS, JSON.stringify(tasks));
    window.dispatchEvent(new CustomEvent('streetlife_pending_tasks_changed', { detail: tasks }));
  } catch (e) {
    console.error('Error saving pending tasks:', e);
  }
}

// Global link tracking to prevent duplicate reuse across any user
export function getUsedLinks(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_GLOBAL_USED_LINKS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function recordUsedLink(link: string): void {
  if (typeof window === 'undefined' || !link) return;
  try {
    const norm = link.trim().toLowerCase();
    const current = getUsedLinks();
    if (!current.includes(norm)) {
      current.push(norm);
      localStorage.setItem(STORAGE_GLOBAL_USED_LINKS, JSON.stringify(current));
    }
  } catch {}
}

export function isLinkAlreadyUsed(link: string): boolean {
  if (!link || typeof window === 'undefined') return false;
  const norm = link.trim().toLowerCase();
  const used = getUsedLinks();
  if (used.includes(norm)) return true;

  // Also check existing submitted pending/approved tasks
  const pending = getPendingTasks();
  return pending.some(
    (t) => t.proofUrl && t.proofUrl.trim().toLowerCase() === norm && t.status !== 'denied'
  );
}

// Section A: Completed One-Time Tasks
export function getCompletedTasks(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_COMPLETED_TASKS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
    }
  } catch {}
  return {};
}

export function markTaskCompleted(taskId: string, reward = 50, taskName = 'Social Task'): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const completed = getCompletedTasks();
    if (completed[taskId]) return false; // Already completed

    completed[taskId] = true;
    localStorage.setItem(STORAGE_COMPLETED_TASKS, JSON.stringify(completed));

    // Credit coins & transaction history
    addGameCoins(reward, `+${reward} SC - Completed ${taskName}`, 'task_reward');
    window.dispatchEvent(new CustomEvent('streetlife_tasks_completed_changed', { detail: completed }));
    return true;
  } catch (e) {
    console.error('Error marking task completed:', e);
    return false;
  }
}

// Section B: Watch Ads
export function getAdsWatchedCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const val = localStorage.getItem(STORAGE_ADS_WATCHED);
    if (val !== null) {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? 0 : Math.min(30, Math.max(0, parsed));
    }
  } catch {}
  return 0;
}

export function incrementAdsWatched(): number {
  if (typeof window === 'undefined') return 0;
  const current = getAdsWatchedCount();
  const next = Math.min(30, current + 1);
  try {
    localStorage.setItem(STORAGE_ADS_WATCHED, next.toString());
    window.dispatchEvent(new CustomEvent('streetlife_ads_watched_changed', { detail: next }));
  } catch {}
  return next;
}

export function isAdsTaskClaimed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_ADS_CLAIMED) === 'true';
}

export function claimAdsTaskReward(): boolean {
  if (typeof window === 'undefined') return false;
  if (isAdsTaskClaimed()) return false;
  const count = getAdsWatchedCount();
  if (count < 30) return false;

  try {
    localStorage.setItem(STORAGE_ADS_CLAIMED, 'true');
    addGameCoins(3000, '+3,000 SC - Watched 30/30 Ads Reward!', 'task_reward');
    window.dispatchEvent(new CustomEvent('streetlife_ads_watched_changed', { detail: 30 }));
    return true;
  } catch {}
  return false;
}

// Section C: Daily limits (Status Post 2/day, Boost 3/day)
export function getDailyTaskSubmissionCount(
  type: 'status_post' | 'boost',
  dateStr = new Date().toISOString().split('T')[0]
): number {
  const pending = getPendingTasks();
  return pending.filter(
    (item) => item.type === type && item.date === dateStr && item.status !== 'denied'
  ).length;
}

// Video Auto-Check Simulation
export function simulateAutoCheckVideo(url: string): {
  validUrl: boolean;
  qualified: boolean;
  likes: number;
  views: number;
  hasHashtag: boolean;
  message: string;
} {
  const trimmed = url.trim().toLowerCase();
  const isYoutube = trimmed.includes('youtube.com') || trimmed.includes('youtu.be');
  const isTiktok = trimmed.includes('tiktok.com');

  if (!isYoutube && !isTiktok) {
    return {
      validUrl: false,
      qualified: false,
      likes: 0,
      views: 0,
      hasHashtag: false,
      message: 'URL must be a valid TikTok or YouTube video link.',
    };
  }

  // Generate realistic stats based on URL hash for consistency
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);

  // Default qualifies for authentic links, but allows testing edge-cases
  const likes = 100 + (absHash % 850);
  const views = 1000 + (absHash % 9000);
  const hasHashtag = true;

  const qualified = likes >= 100 && views >= 1000 && hasHashtag;

  return {
    validUrl: true,
    qualified,
    likes,
    views,
    hasHashtag,
    message: qualified
      ? 'Video Qualified! Passed verification requirements.'
      : `Not Qualified Yet - Keep Pushing! Likes ${likes}/100 ❌ Views ${views}/1000 ❌`,
  };
}

// Admin Action: Approve
export function approveTask(taskId: string): { success: boolean; reward: number; message: string } {
  const tasks = getPendingTasks();
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return { success: false, reward: 0, message: 'Task not found' };

  const task = tasks[idx];
  if (task.status === 'approved') {
    return { success: false, reward: 0, message: 'Task already approved' };
  }

  task.status = 'approved';
  task.approvedAt = Date.now();
  savePendingTasks(tasks);

  // Credit player balance
  addGameCoins(task.reward, `+${task.reward} SC - Admin Approved ${task.type.toUpperCase()}`, 'task_reward');

  return {
    success: true,
    reward: task.reward,
    message: `Task approved! +${task.reward} SC credited to player.`,
  };
}

// Admin Action: Deny
export function denyTask(taskId: string, reason = 'Proof does not meet verification requirements.'): { success: boolean; message: string } {
  const tasks = getPendingTasks();
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return { success: false, message: 'Task not found' };

  tasks[idx].status = 'denied';
  tasks[idx].denialReason = reason;
  savePendingTasks(tasks);

  return { success: true, message: 'Task rejected.' };
}
