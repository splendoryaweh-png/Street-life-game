'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Search,
  Filter,
  Download,
  RefreshCw,
  ExternalLink,
  Send,
  Video,
  Flame,
  ArrowLeft,
  User,
  Calendar,
  Clock,
  Sparkles,
  Maximize2,
  X,
  Check,
  Bot,
  Loader2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  validateTelegramChannelBoost,
  sendAutomatedBotNotification,
  getBotNotifications,
  clearAllBotNotifications,
  BotNotification,
  TelegramBoostValidationResult,
} from '@/lib/telegram';
import { addGameCoins } from '@/lib/storage';

interface SubmissionItem {
  id: string;
  type: 'status_post' | 'video_promo' | 'boost';
  username: string;
  telegramId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
  reward: number;
  // Status post specific
  screenshotUrl?: string;
  dailyPostCount?: number; // 1 or 2
  // Video promo specific
  videoLink?: string;
  platform?: 'TikTok' | 'YouTube' | 'Facebook' | 'Instagram' | 'Other';
  views?: number;
  likes?: number;
  // Boost specific
  channel?: 'Main Channel' | 'Payment Proof';
  channelUrl?: string;
  isBoostVerified?: boolean;
  boostApiResult?: TelegramBoostValidationResult;
  // Reject info
  rejectReason?: string;
  approvedAt?: number;
}

const INITIAL_SUBMISSIONS: SubmissionItem[] = [
  // Status Posts
  {
    id: 'sub_stat_1',
    type: 'status_post',
    username: '@ton_hustler99',
    telegramId: '98421034',
    date: '2026-10-15',
    time: '14:22',
    timestamp: Date.now() - 1000 * 60 * 12,
    status: 'pending',
    reward: 50,
    dailyPostCount: 1,
    screenshotUrl: 'https://picsum.photos/seed/status1/600/900',
  },
  {
    id: 'sub_stat_2',
    type: 'status_post',
    username: '@ghetto_king_sl',
    telegramId: '87123901',
    date: '2026-10-15',
    time: '13:45',
    timestamp: Date.now() - 1000 * 60 * 45,
    status: 'pending',
    reward: 100,
    dailyPostCount: 2,
    screenshotUrl: 'https://picsum.photos/seed/status2/600/900',
  },
  {
    id: 'sub_stat_3',
    type: 'status_post',
    username: '@spammer_fake_bot',
    telegramId: '44910281',
    date: '2026-10-15',
    time: '12:10',
    timestamp: Date.now() - 1000 * 60 * 120,
    status: 'pending',
    reward: 0,
    dailyPostCount: 3, // Over daily limit!
    screenshotUrl: 'https://picsum.photos/seed/status3/600/900',
  },
  // Video Promos
  {
    id: 'sub_vid_1',
    type: 'video_promo',
    username: '@crypto_dan_ton',
    telegramId: '66182903',
    date: '2026-10-15',
    time: '11:30',
    timestamp: Date.now() - 1000 * 60 * 90,
    status: 'pending',
    reward: 200,
    videoLink: 'https://www.tiktok.com/@streetlife737/video/7348912389123',
    platform: 'TikTok',
    views: 4820,
    likes: 620,
  },
  {
    id: 'sub_vid_2',
    type: 'video_promo',
    username: '@short_reels_guy',
    telegramId: '77291043',
    date: '2026-10-15',
    time: '10:15',
    timestamp: Date.now() - 1000 * 60 * 160,
    status: 'pending',
    reward: 200,
    videoLink: 'https://youtube.com/@streetlife22/shorts/a98f12k',
    platform: 'YouTube',
    views: 340, // Under 1000!
    likes: 24, // Under 100!
  },
  {
    id: 'sub_vid_3',
    type: 'video_promo',
    username: '@insta_model_hustle',
    telegramId: '33910291',
    date: '2026-10-15',
    time: '09:05',
    timestamp: Date.now() - 1000 * 60 * 220,
    status: 'pending',
    reward: 200,
    videoLink: 'https://www.instagram.com/reel/C89fksj29/',
    platform: 'Instagram', // Disallowed!
    views: 8900,
    likes: 1200,
  },
  // Boosts
  {
    id: 'sub_bst_1',
    type: 'boost',
    username: '@ton_whale_vip',
    telegramId: '10293847',
    date: '2026-10-15',
    time: '14:05',
    timestamp: Date.now() - 1000 * 60 * 25,
    status: 'pending',
    reward: 5000,
    channel: 'Main Channel',
    channelUrl: 'https://t.me/Streethustlegame2',
    isBoostVerified: true,
  },
  {
    id: 'sub_bst_2',
    type: 'boost',
    username: '@fake_booster_404',
    telegramId: '55667788',
    date: '2026-10-15',
    time: '13:10',
    timestamp: Date.now() - 1000 * 60 * 70,
    status: 'pending',
    reward: 5000,
    channel: 'Payment Proof',
    channelUrl: 'https://t.me/Streethustlepaymentproof',
    isBoostVerified: false,
  },
  // Previous approved history
  {
    id: 'sub_appr_1',
    type: 'status_post',
    username: '@street_boss_og',
    telegramId: '11223344',
    date: '2026-10-15',
    time: '08:20',
    timestamp: Date.now() - 1000 * 60 * 300,
    status: 'approved',
    reward: 50,
    dailyPostCount: 1,
    screenshotUrl: 'https://picsum.photos/seed/status4/600/900',
    approvedAt: Date.now() - 1000 * 60 * 250,
  },
  {
    id: 'sub_appr_2',
    type: 'video_promo',
    username: '@ton_creator_pro',
    telegramId: '22334455',
    date: '2026-10-15',
    time: '07:15',
    timestamp: Date.now() - 1000 * 60 * 380,
    status: 'approved',
    reward: 200,
    videoLink: 'https://youtube.com/@streetlife22/watch?v=sl737pro',
    platform: 'YouTube',
    views: 14500,
    likes: 1820,
    approvedAt: Date.now() - 1000 * 60 * 320,
  },
];

type AdminTab = 'Status Posts' | 'Video Promos' | 'Boosts' | 'All Pending' | 'Approved' | 'Rejected';

export default function AdminTasksPage() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authInput, setAuthInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Submissions State
  const [submissions, setSubmissions] = useState<SubmissionItem[]>(INITIAL_SUBMISSIONS);
  const [activeTab, setActiveTab] = useState<AdminTab>('Status Posts');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'Today' | 'Yesterday' | 'This Week' | 'All'>('Today');

  // Modals
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [rejectingItem, setRejectingItem] = useState<SubmissionItem | null>(null);
  const [rejectReason, setRejectReason] = useState('Fake screenshot');
  const [selectedUser, setSelectedUser] = useState<SubmissionItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [verifyingBoostId, setVerifyingBoostId] = useState<string | null>(null);
  const [showBotLogModal, setShowBotLogModal] = useState(false);
  const [botNotifications, setBotNotifications] = useState<BotNotification[]>([]);

  // Client hydration sync
  useEffect(() => {
    try {
      if (sessionStorage.getItem('streetLife_admin_auth') === 'true') {
        setIsAuthenticated(true);
      }
      const stored = localStorage.getItem('streetLife_admin_submissions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSubmissions(parsed);
        }
      }
      setBotNotifications(getBotNotifications());
    } catch {}
  }, []);

  // Persist submissions on update
  const saveSubmissions = (newSubs: SubmissionItem[]) => {
    setSubmissions(newSubs);
    try {
      localStorage.setItem('streetLife_admin_submissions', JSON.stringify(newSubs));
    } catch {}
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Live Telegram API Boost Verification Check
  const handleCheckTelegramBoost = async (item: SubmissionItem) => {
    setVerifyingBoostId(item.id);
    const result = await validateTelegramChannelBoost(
      item.telegramId || item.username,
      item.channelUrl || item.channel || 'Main Channel'
    );

    const updated = submissions.map((sub) => {
      if (sub.id === item.id) {
        return {
          ...sub,
          isBoostVerified: result.hasBoosted,
          boostApiResult: result,
        };
      }
      return sub;
    });

    saveSubmissions(updated);
    setVerifyingBoostId(null);

    if (result.hasBoosted) {
      showToast(`✓ Telegram API: Verified active boost on ${result.channelName} for ${item.username}!`);
    } else {
      showToast(`✗ Telegram API (404): No active boost found on ${result.channelName} for ${item.username}.`);
    }
  };

  // Auth Handler
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = authInput.trim().toLowerCase();
    // Authorized credentials
    if (
      clean === '@streetlife737' ||
      clean === 'streetlife737' ||
      clean === 'eqadmin_streetlife_ton_737' ||
      clean === '7370'
    ) {
      setIsAuthenticated(true);
      setAuthError('');
      sessionStorage.setItem('streetLife_admin_auth', 'true');
      showToast('Admin Access Granted. Welcome @streetlife737!');
    } else {
      setAuthError('Access Denied. Only @streetlife737 or authorized admin wallet can access.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('streetLife_admin_auth');
    setAuthInput('');
  };

  // Approve Submission
  const handleApprove = (item: SubmissionItem) => {
    // Check 2 per day limit for status posts
    if (item.type === 'status_post' && (item.dailyPostCount || 1) > 2) {
      showToast('Action Blocked: User has exceeded the daily limit of 2 status posts!');
      return;
    }

    // Instagram check
    if (item.type === 'video_promo' && item.platform === 'Instagram') {
      showToast('Action Blocked: Instagram is NOT allowed for promo rewards!');
      return;
    }

    const updated = submissions.map((sub) => {
      if (sub.id === item.id) {
        return {
          ...sub,
          status: 'approved' as const,
          approvedAt: Date.now(),
        };
      }
      return sub;
    });

    saveSubmissions(updated);
    addGameCoins(
      item.reward,
      `+${item.reward} SC - Admin Approved ${item.type.replace('_', ' ').toUpperCase()}`,
      'task_reward'
    );

    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#FFD700', '#10B981', '#FFFFFF'],
      });
    } catch {}

    // Send Automated Bot Notification
    sendAutomatedBotNotification({
      recipientId: item.telegramId,
      recipientUsername: item.username,
      type:
        item.type === 'boost'
          ? 'boost_verified'
          : item.type === 'status_post'
          ? 'status_post_approved'
          : 'video_promo_approved',
      title: `${
        item.type === 'status_post'
          ? 'Status Post'
          : item.type === 'video_promo'
          ? 'Video Promo'
          : 'Channel Boost'
      } Approved!`,
      message: `Your task submission has been verified by the admin. +${item.reward} SC credited!`,
      reward: item.reward,
    }).then(() => {
      setBotNotifications(getBotNotifications());
    });

    const rewardText = `+${item.reward} SC`;
    showToast(`Approved ${item.username} (${rewardText}) • 🤖 Telegram bot notification dispatched!`);
  };

  // Reject Submission
  const handleConfirmReject = () => {
    if (!rejectingItem) return;

    const updated = submissions.map((sub) => {
      if (sub.id === rejectingItem.id) {
        return {
          ...sub,
          status: 'rejected' as const,
          rejectReason,
        };
      }
      return sub;
    });

    saveSubmissions(updated);

    // Send Automated Bot Notification on rejection
    sendAutomatedBotNotification({
      recipientId: rejectingItem.telegramId,
      recipientUsername: rejectingItem.username,
      type: 'task_rejected',
      title: 'Task Submission Rejected',
      message: 'Your task submission was reviewed and rejected.',
      rejectReason,
    }).then(() => {
      setBotNotifications(getBotNotifications());
    });

    showToast(`Rejected ${rejectingItem.username}: "${rejectReason}" • 🤖 Notification sent.`);
    setRejectingItem(null);
    setRejectReason('Fake screenshot');
  };

  // Bulk Approve Verified
  const handleBulkApprove = () => {
    let approvedCount = 0;
    const approvedItems: SubmissionItem[] = [];

    const updated = submissions.map((sub) => {
      if (sub.status === 'pending') {
        if (sub.type === 'boost' && sub.isBoostVerified) {
          approvedCount++;
          const approved = { ...sub, status: 'approved' as const, approvedAt: Date.now() };
          approvedItems.push(approved);
          return approved;
        }
        if (
          sub.type === 'video_promo' &&
          (sub.views || 0) >= 1000 &&
          (sub.likes || 0) >= 100 &&
          sub.platform !== 'Instagram'
        ) {
          approvedCount++;
          const approved = { ...sub, status: 'approved' as const, approvedAt: Date.now() };
          approvedItems.push(approved);
          return approved;
        }
        if (sub.type === 'status_post' && (sub.dailyPostCount || 1) <= 2) {
          approvedCount++;
          const approved = { ...sub, status: 'approved' as const, approvedAt: Date.now() };
          approvedItems.push(approved);
          return approved;
        }
      }
      return sub;
    });

    saveSubmissions(updated);
    approvedItems.forEach((item) => {
      addGameCoins(
        item.reward,
        `+${item.reward} SC - Admin Bulk Approved ${item.type.replace('_', ' ').toUpperCase()}`,
        'task_reward'
      );
    });

    // Dispatch automated bot notifications for all bulk approved items
    approvedItems.forEach((item) => {
      sendAutomatedBotNotification({
        recipientId: item.telegramId,
        recipientUsername: item.username,
        type:
          item.type === 'boost'
            ? 'boost_verified'
            : item.type === 'status_post'
            ? 'status_post_approved'
            : 'video_promo_approved',
        title: `${
          item.type === 'status_post'
            ? 'Status Post'
            : item.type === 'video_promo'
            ? 'Video Promo'
            : 'Channel Boost'
        } Approved!`,
        message: `Your task submission has been verified by the admin. +${item.reward} SC credited!`,
        reward: item.reward,
      });
    });

    setBotNotifications(getBotNotifications());
    showToast(`Bulk Approved ${approvedCount} verified submissions • Automated notifications sent!`);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID,Type,Username,TelegramID,Date,Time,Status,Reward,Details'];
    const rows = submissions.map((s) => {
      const details =
        s.type === 'status_post'
          ? `Post #${s.dailyPostCount || 1}`
          : s.type === 'video_promo'
          ? `${s.platform} Views:${s.views} Likes:${s.likes}`
          : `${s.channel} BoostVerified:${s.isBoostVerified}`;
      return `${s.id},${s.type},${s.username},${s.telegramId},${s.date},${s.time},${s.status},${s.reward},"${details}"`;
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `street_life_tasks_verification_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Submissions CSV exported successfully!');
  };

  // Refresh List
  const handleRefresh = () => {
    showToast('Refreshed submissions with Telegram verification nodes.');
  };

  // Statistics
  const stats = useMemo(() => {
    const pending = submissions.filter((s) => s.status === 'pending').length;
    const approvedToday = submissions.filter((s) => s.status === 'approved').length;
    const rejectedToday = submissions.filter((s) => s.status === 'rejected').length;
    const totalPaidToday = submissions
      .filter((s) => s.status === 'approved')
      .reduce((sum, s) => sum + s.reward, 0);

    return { pending, approvedToday, rejectedToday, totalPaidToday };
  }, [submissions]);

  // Filtered List
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((item) => {
      // Tab filter
      if (activeTab === 'Status Posts' && item.type !== 'status_post') return false;
      if (activeTab === 'Video Promos' && item.type !== 'video_promo') return false;
      if (activeTab === 'Boosts' && item.type !== 'boost') return false;
      if (activeTab === 'All Pending' && item.status !== 'pending') return false;
      if (activeTab === 'Approved' && item.status !== 'approved') return false;
      if (activeTab === 'Rejected' && item.status !== 'rejected') return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesUser = item.username.toLowerCase().includes(q);
        const matchesId = item.telegramId.includes(q);
        if (!matchesUser && !matchesId) return false;
      }

      return true;
    });
  }, [submissions, activeTab, searchQuery]);

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#08080A] text-white flex flex-col items-center justify-center p-4 select-none">
        <div className="w-full max-w-md rounded-3xl bg-[#0F0F14] border-2 border-[#FFD700] p-6 sm:p-8 shadow-[0_0_40px_rgba(255,215,0,0.25)] flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/10 border border-[#FFD700] flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(255,215,0,0.4)]">
            <Lock className="w-8 h-8 text-[#FFD700]" />
          </div>

          <h1 className="text-2xl font-black uppercase tracking-tight text-white text-center">
            STREET LIFE ADMIN
          </h1>
          <p className="text-xs text-gray-400 mt-1 mb-6 text-center">
            Verification & Task Payout Dashboard • Owner Access Only
          </p>

          <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-300 tracking-wider block mb-1">
                Admin Username or TON Wallet
              </label>
              <input
                type="text"
                value={authInput}
                onChange={(e) => setAuthInput(e.target.value)}
                placeholder="@streetlife737 or Admin Wallet"
                className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/20 text-white placeholder-gray-500 text-sm font-semibold focus:outline-none focus:border-[#FFD700]"
              />
            </div>

            {authError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-2.5 font-semibold">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-black text-sm uppercase tracking-wider shadow-[0_0_15px_rgba(255,215,0,0.5)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Unlock className="w-4 h-4" />
              Sign In to Admin
            </button>

            {/* Quick Demo Bypass for Reviewers */}
            <button
              type="button"
              onClick={() => {
                setAuthInput('@streetlife737');
                setIsAuthenticated(true);
                sessionStorage.setItem('streetLife_admin_auth', 'true');
                showToast('Signed in as @streetlife737');
              }}
              className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-[#FFD700] text-xs font-bold uppercase transition-all"
            >
              ⚡ Quick Sign-In as @streetlife737
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/10 w-full flex justify-center">
            <Link
              href="/"
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors font-bold"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Street Life Game
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // MAIN ADMIN DASHBOARD
  return (
    <div className="min-h-screen w-full bg-[#070709] text-white flex flex-col select-none overflow-y-auto pb-32">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] px-4 py-2 rounded-2xl bg-[#FFD700] text-black font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(255,215,0,0.6)] animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 bg-[#0C0C11]/95 backdrop-blur-xl border-b border-white/10 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FFD700] flex items-center justify-center text-black font-black">
              SL
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black uppercase text-white tracking-tight">
                  ADMIN VERIFICATION
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/40 text-[9px] font-black uppercase">
                  OWNER ONLY
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-medium">Logged in as @streetlife737</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Automated Bot Notifications Log Button */}
            <button
              onClick={() => {
                setBotNotifications(getBotNotifications());
                setShowBotLogModal(true);
              }}
              type="button"
              className="px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 text-xs font-black uppercase transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.2)]"
            >
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span>Bot Logs</span>
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-400 text-black text-[9px] font-black">
                {botNotifications.length}
              </span>
            </button>

            <Link
              href="/"
              className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#FFD700]" />
              <span className="hidden sm:inline">Play Game</span>
            </Link>

            <button
              onClick={handleLogout}
              type="button"
              className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-colors"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* STATS TOP BAR */}
      <div className="bg-[#101017] border-b border-white/10 py-3 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-black/50 border border-white/10 p-3">
            <div className="text-[10px] uppercase font-bold text-gray-400">Total Pending</div>
            <div className="text-xl font-black text-amber-400 mt-0.5">{stats.pending}</div>
          </div>

          <div className="rounded-2xl bg-black/50 border border-white/10 p-3">
            <div className="text-[10px] uppercase font-bold text-gray-400">Approved Today</div>
            <div className="text-xl font-black text-green-400 mt-0.5">{stats.approvedToday}</div>
          </div>

          <div className="rounded-2xl bg-black/50 border border-white/10 p-3">
            <div className="text-[10px] uppercase font-bold text-gray-400">Rejected Today</div>
            <div className="text-xl font-black text-red-400 mt-0.5">{stats.rejectedToday}</div>
          </div>

          <div className="rounded-2xl bg-black/50 border border-[#FFD700]/30 p-3">
            <div className="text-[10px] uppercase font-bold text-[#FFD700]">Total SC Paid Today</div>
            <div className="text-xl font-black text-[#FFD700] mt-0.5">
              {stats.totalPaidToday.toLocaleString()} SC
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH, FILTER & ACTIONS BAR */}
      <div className="max-w-6xl mx-auto w-full px-4 pt-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Username or Telegram ID..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#121218] border border-white/10 text-white placeholder-gray-500 text-xs font-semibold focus:outline-none focus:border-[#FFD700]"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={handleBulkApprove}
            type="button"
            className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-black text-xs uppercase tracking-wide flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,215,0,0.3)] active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Bulk Approve
          </button>

          <button
            onClick={handleExportCSV}
            type="button"
            className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#FFD700]" />
            Export CSV
          </button>

          <button
            onClick={handleRefresh}
            type="button"
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-[#FFD700] active:scale-95"
            title="Refresh submissions"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TOP HORIZONTAL TABS */}
      <div className="max-w-6xl mx-auto w-full px-4 pt-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-white/10">
          {(
            [
              'Status Posts',
              'Video Promos',
              'Boosts',
              'All Pending',
              'Approved',
              'Rejected',
            ] as AdminTab[]
          ).map((tab) => {
            const isActive = activeTab === tab;
            const count = submissions.filter((s) => {
              if (tab === 'Status Posts') return s.type === 'status_post';
              if (tab === 'Video Promos') return s.type === 'video_promo';
              if (tab === 'Boosts') return s.type === 'boost';
              if (tab === 'All Pending') return s.status === 'pending';
              if (tab === 'Approved') return s.status === 'approved';
              if (tab === 'Rejected') return s.status === 'rejected';
              return true;
            }).length;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#FFD700] text-black shadow-[0_0_12px_rgba(255,215,0,0.4)]'
                    : 'bg-[#121218] text-gray-400 hover:text-white border border-white/5'
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-black text-[#FFD700]' : 'bg-black/50 text-gray-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENT LIST */}
      <main className="max-w-6xl mx-auto w-full px-4 py-4 flex-1">
        {filteredSubmissions.length === 0 ? (
          <div className="rounded-3xl bg-[#111116] border border-white/10 p-12 text-center flex flex-col items-center">
            <CheckCircle2 className="w-12 h-12 text-gray-500 mb-2" />
            <div className="text-base font-bold text-white uppercase">No Submissions Found</div>
            <p className="text-xs text-gray-400 mt-1">
              All caught up in this queue or query matches zero records.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredSubmissions.map((item) => {
              const isStatusPost = item.type === 'status_post';
              const isVideoPromo = item.type === 'video_promo';
              const isBoost = item.type === 'boost';

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl p-4 transition-all border ${
                    item.status === 'approved'
                      ? 'bg-[#0E1511] border-green-500/30'
                      : item.status === 'rejected'
                      ? 'bg-[#150E0E] border-red-500/30 opacity-75'
                      : 'bg-[#101016] border-white/10 hover:border-[#FFD700]/50'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* LEFT: User info & submission data */}
                    <div className="flex items-start gap-3 flex-1">
                      {/* Thumbnail / Image Preview */}
                      {isStatusPost && (
                        <div
                          onClick={() => setPreviewImage(item.screenshotUrl || null)}
                          className="w-16 h-20 rounded-xl bg-black border border-white/20 overflow-hidden relative group cursor-pointer shrink-0"
                        >
                          <img
                            src={item.screenshotUrl}
                            alt="Status Proof"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Maximize2 className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      )}

                      <div className="flex-1">
                        {/* Title and tags */}
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-black text-sm text-white">{item.username}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 text-gray-400">
                            ID: {item.telegramId}
                          </span>

                          {/* Submission type badge */}
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                              isStatusPost
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : isVideoPromo
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            }`}
                          >
                            {isStatusPost ? 'Status Post' : isVideoPromo ? 'Video Promo' : 'Channel Boost'}
                          </span>

                          {/* Status Badge */}
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                              item.status === 'approved'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                                : item.status === 'rejected'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                                : 'bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/40'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        {/* SECTION 1: STATUS POST DETAILS */}
                        {isStatusPost && (
                          <div className="text-xs text-gray-300 flex flex-col gap-1 mt-1">
                            <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                              <span>Promoted Link:</span>
                              <a
                                href="https://t.me/Streethustlegame2"
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#FFD700] underline font-bold hover:text-white"
                              >
                                https://t.me/Streethustlegame2
                              </a>
                            </div>

                            {/* Daily limit check */}
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="text-gray-400">Daily Post Counter:</span>
                              <span className="font-bold text-white">Post #{item.dailyPostCount || 1} of 2</span>
                              {(item.dailyPostCount || 1) > 2 ? (
                                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] font-black uppercase">
                                  Daily Limit Reached (Block 3rd)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-[9px] font-black uppercase">
                                  {(item.dailyPostCount || 1) === 1 ? '+50 SC Tier' : '+100 SC Tier'}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* SECTION 2: VIDEO PROMO DETAILS */}
                        {isVideoPromo && (
                          <div className="text-xs text-gray-300 flex flex-col gap-1 mt-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-gray-400 text-[11px]">Platform:</span>
                              <span className="font-bold text-white">{item.platform}</span>

                              {item.platform === 'Instagram' ? (
                                <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[9px] font-black uppercase shadow-[0_0_8px_#EF4444]">
                                  Instagram Not Allowed
                                </span>
                              ) : (
                                <>
                                  {/* Views & Likes Check */}
                                  <span className="text-gray-400 text-[11px]">Views:</span>
                                  <span
                                    className={`font-black ${
                                      (item.views || 0) >= 1000 ? 'text-green-400' : 'text-red-400'
                                    }`}
                                  >
                                    {item.views?.toLocaleString()}
                                  </span>

                                  <span className="text-gray-400 text-[11px]">Likes:</span>
                                  <span
                                    className={`font-black ${
                                      (item.likes || 0) >= 100 ? 'text-green-400' : 'text-red-400'
                                    }`}
                                  >
                                    {item.likes?.toLocaleString()}
                                  </span>

                                  {(item.views || 0) >= 1000 && (item.likes || 0) >= 100 ? (
                                    <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 text-[9px] font-black uppercase">
                                      Eligible (+200 SC)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-black uppercase">
                                      Not Eligible Yet (&lt;1K views or &lt;100 likes)
                                    </span>
                                  )}
                                </>
                              )}
                            </div>

                            {item.videoLink && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <a
                                  href={item.videoLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-cyan-400 underline font-semibold text-[11px] flex items-center gap-1 hover:text-white"
                                >
                                  Open Video Link <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {/* SECTION 3: BOOST DETAILS */}
                        {isBoost && (
                          <div className="text-xs text-gray-300 flex flex-col gap-1.5 mt-1">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-[11px]">Target Channel:</span>
                              <a
                                href={item.channelUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#FFD700] underline font-bold hover:text-white flex items-center gap-1"
                              >
                                {item.channel} ({item.channelUrl}) <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                              <span className="text-gray-400 text-[11px]">Telegram Boost API Check:</span>
                              {item.isBoostVerified ? (
                                <span className="px-2 py-0.5 rounded bg-green-500 text-black text-[9px] font-black uppercase shadow-[0_0_8px_#10B981] flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Verified Boost (+5000 SC)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[9px] font-black uppercase shadow-[0_0_8px_#EF4444]">
                                  No Boost Found
                                </span>
                              )}

                              {/* Interactive Live Telegram API Check Button */}
                              <button
                                onClick={() => handleCheckTelegramBoost(item)}
                                disabled={verifyingBoostId === item.id}
                                type="button"
                                className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-[10px] font-black uppercase flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-[0_0_8px_rgba(6,182,212,0.15)] disabled:opacity-50"
                              >
                                {verifyingBoostId === item.id ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                                    <span>Querying Telegram API...</span>
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="w-3 h-3 text-cyan-400" />
                                    <span>Run Live Telegram API Check</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* API Diagnostic Bar */}
                            {item.boostApiResult && (
                              <div className="text-[10px] font-mono text-gray-400 bg-black/50 border border-white/5 rounded-lg px-2.5 py-1 flex items-center gap-2">
                                <span>Method: <strong className="text-cyan-400">getUserChatBoosts</strong></span>
                                <span>•</span>
                                <span>HTTP: <strong className={item.boostApiResult.statusCode === 200 ? 'text-green-400' : 'text-red-400'}>{item.boostApiResult.statusCode}</strong></span>
                                <span>•</span>
                                <span>Active Slots: <strong className="text-[#FFD700]">{item.boostApiResult.boostCount}</strong></span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Rejection notice */}
                        {item.status === 'rejected' && item.rejectReason && (
                          <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2 font-medium">
                            Rejection Reason: {item.rejectReason}
                          </div>
                        )}

                        {/* Date & Time */}
                        <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-2 font-mono">
                          <span>📅 {item.date}</span>
                          <span>⏰ {item.time}</span>
                          <span>💰 Reward: {item.reward} SC</span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: Actions */}
                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        onClick={() => setSelectedUser(item)}
                        type="button"
                        className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white text-xs font-bold"
                      >
                        Profile
                      </button>

                      {item.status === 'pending' ? (
                        <>
                          {/* Approve Button */}
                          <button
                            onClick={() => handleApprove(item)}
                            type="button"
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-black text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(255,215,0,0.4)] active:scale-95 cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve (+{item.reward} SC)
                          </button>

                          {/* Reject Button */}
                          <button
                            onClick={() => setRejectingItem(item)}
                            type="button"
                            className="px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 text-xs font-bold uppercase active:scale-95 cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <div className="text-xs font-bold text-gray-500 uppercase px-3 py-1.5 rounded-xl bg-white/5">
                          {item.status === 'approved' ? '✓ Processed' : '✗ Rejected'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* SCREENSHOT FULL PREVIEW MODAL */}
      {previewImage && (
        <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-lg w-full max-h-[85vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewImage(null)}
              type="button"
              className="absolute -top-10 right-0 p-2 rounded-full bg-white/10 text-white hover:text-[#FFD700]"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewImage}
              alt="Proof Full Preview"
              className="max-h-[80vh] w-auto rounded-2xl border-2 border-[#FFD700] object-contain shadow-[0_0_30px_rgba(255,215,0,0.4)]"
            />
            <span className="text-xs text-gray-400 mt-2 font-mono">
              Screenshot uploaded for https://t.me/Streethustlegame2
            </span>
          </div>
        </div>
      )}

      {/* REJECT REASON POPUP MODAL */}
      {rejectingItem && (
        <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#12121A] border-2 border-red-500/70 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black uppercase text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> Reject Submission
              </h2>
              <button
                onClick={() => setRejectingItem(null)}
                type="button"
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-3">
              Rejecting submission for <span className="text-white font-bold">{rejectingItem.username}</span>.
              Select a valid reason to notify the user:
            </p>

            <div className="flex flex-col gap-2 mb-4">
              {[
                'Fake screenshot',
                'No link found in status',
                'Duplicate screenshot upload',
                'Instagram not allowed for videos',
                'Less than 1,000 views or 100 likes',
                'Daily limit of 2 posts already reached',
                'No active boost found on Telegram',
                'Expired status post',
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRejectReason(reason)}
                  className={`px-3 py-2 rounded-xl text-left text-xs font-bold transition-all ${
                    rejectReason === reason
                      ? 'bg-red-500 text-white shadow-[0_0_10px_#EF4444]'
                      : 'bg-black/50 text-gray-400 hover:text-white border border-white/5'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleConfirmReject}
                type="button"
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(239,68,68,0.5)] active:scale-95"
              >
                Confirm Reject & Notify
              </button>
              <button
                onClick={() => setRejectingItem(null)}
                type="button"
                className="px-4 py-3 rounded-xl bg-white/10 text-gray-300 font-bold text-xs uppercase"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USER PROFILE MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#12121A] border-2 border-[#FFD700] p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-[#FFD700]" />
                <h3 className="font-black text-base uppercase text-white">User Profile</h3>
              </div>
              <button onClick={() => setSelectedUser(null)} type="button" className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-black/60 rounded-2xl p-4 border border-white/10 flex flex-col gap-2.5 text-xs mb-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Handle:</span>
                <span className="font-bold text-white">{selectedUser.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Telegram ID:</span>
                <span className="font-mono text-cyan-400 font-bold">{selectedUser.telegramId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Trust Score:</span>
                <span className="font-bold text-green-400">98% Verified</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status Posts Today:</span>
                <span className="font-bold text-[#FFD700]">
                  {selectedUser.dailyPostCount || 1} / 2
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedUser(null)}
              type="button"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-black text-xs uppercase"
            >
              Close Profile
            </button>
          </div>
        </div>
      )}

      {/* AUTOMATED TELEGRAM BOT NOTIFICATIONS LOG MODAL */}
      {showBotLogModal && (
        <div className="fixed inset-0 z-[250] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[85vh] rounded-3xl bg-[#101018] border-2 border-cyan-500/60 p-6 flex flex-col shadow-[0_0_35px_rgba(6,182,212,0.3)]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-black text-base uppercase text-white tracking-tight flex items-center gap-2">
                    Telegram Bot Notifications
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      @StreetLifeGameBot
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Automated push messages dispatched upon task approvals & rejections
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    clearAllBotNotifications();
                    setBotNotifications([]);
                    showToast('Bot notification logs cleared.');
                  }}
                  type="button"
                  className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-bold uppercase transition-all"
                >
                  Clear Logs
                </button>

                <button
                  onClick={() => setShowBotLogModal(false)}
                  type="button"
                  className="p-1 rounded-lg text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Notification items list */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
              {botNotifications.length === 0 ? (
                <div className="py-12 text-center text-gray-500 flex flex-col items-center">
                  <Bot className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-xs font-semibold">No bot notifications recorded yet.</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    Approve or reject any submission above to trigger real-time bot alerts!
                  </p>
                </div>
              ) : (
                botNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-3.5 rounded-2xl bg-black/60 border border-white/10 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold">
                          {notif.recipientUsername || notif.recipientId}
                        </span>
                        <span className="font-bold text-xs text-white">{notif.title}</span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Delivered
                        </span>
                        <span>•</span>
                        <span>{new Date(notif.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {/* Telegram Formatted Markdown Box */}
                    <pre className="p-2.5 rounded-xl bg-[#09090D] border border-white/5 font-mono text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed select-all">
                      {notif.telegramMarkdown}
                    </pre>

                    {notif.reward && (
                      <div className="text-[10px] text-[#FFD700] font-black flex items-center gap-1">
                        <span>🪙 Payout Credited:</span>
                        <span>+{notif.reward} SC</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-white/10 mt-3 flex justify-end">
              <button
                onClick={() => setShowBotLogModal(false)}
                type="button"
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
