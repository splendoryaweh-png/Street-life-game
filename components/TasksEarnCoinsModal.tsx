'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ExternalLink,
  CheckCircle2,
  Clock,
  Tv,
  Upload,
  Video,
  Send,
  Zap,
  Check,
  AlertCircle,
  Sparkles,
  Youtube,
  Twitter,
  Coins,
  ShieldCheck,
  Play,
  RotateCcw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { playClickSound, playSuccessSound, playCoinSound } from '@/lib/sound';
import {
  getCompletedTasks,
  markTaskCompleted,
  getAdsWatchedCount,
  incrementAdsWatched,
  isAdsTaskClaimed,
  claimAdsTaskReward,
  getPendingTasks,
  savePendingTasks,
  isLinkAlreadyUsed,
  recordUsedLink,
  simulateAutoCheckVideo,
  getDailyTaskSubmissionCount,
  PendingTaskItem,
} from '@/lib/tasksSystem';

interface TasksEarnCoinsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
  currentCoins?: number;
}

export function TasksEarnCoinsModal({
  isOpen,
  onClose,
  onToast,
}: TasksEarnCoinsModalProps) {
  // Section A State (One-time tasks)
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>(() =>
    getCompletedTasks()
  );
  const [clickedLinks, setClickedLinks] = useState<Record<string, boolean>>({});

  // Section B State (Watch 30 Ads)
  const [adsWatched, setAdsWatched] = useState<number>(() => getAdsWatchedCount());
  const [adsClaimed, setAdsClaimed] = useState<boolean>(() => isAdsTaskClaimed());
  const [isWatchingAdModalOpen, setIsWatchingAdModalOpen] = useState(false);
  const [adTimerSeconds, setAdTimerSeconds] = useState(15);

  // Section C State (Status Post & Boost)
  const [statusPlatform, setStatusPlatform] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [statusLinkInput, setStatusLinkInput] = useState('');
  const [statusScreenshot1, setStatusScreenshot1] = useState<string>('');
  const [statusScreenshot2, setStatusScreenshot2] = useState<string>('');
  const [boostScreenshot, setBoostScreenshot] = useState<string>('');

  // Section D State (Video Task)
  const [videoLinkInput, setVideoLinkInput] = useState('');
  const [videoChecking, setVideoChecking] = useState(false);
  const [videoFeedback, setVideoFeedback] = useState<{
    tested: boolean;
    qualified: boolean;
    likes: number;
    views: number;
    hasHashtag: boolean;
    message: string;
  } | null>(null);

  // General state
  const [pendingTasks, setPendingTasks] = useState<PendingTaskItem[]>(() => getPendingTasks());

  // Toast Notification System for Tasks Earn Coins
  const [inModalToast, setInModalToast] = useState<{
    id: string;
    type: 'pending' | 'success' | 'error' | 'info';
    title: string;
    message: string;
    reward?: number;
  } | null>(null);

  const triggerToast = useCallback(
    (toast: {
      type: 'pending' | 'success' | 'error' | 'info';
      title: string;
      message: string;
      reward?: number;
    }) => {
      const id = `toast_${Date.now()}`;
      setInModalToast({ ...toast, id });
      if (onToast) onToast(`${toast.title}: ${toast.message}`);
    },
    [onToast]
  );

  useEffect(() => {
    if (!inModalToast) return;
    const timer = setTimeout(() => {
      setInModalToast(null);
    }, 5500);
    return () => clearTimeout(timer);
  }, [inModalToast]);

  // Listen to tasks events
  useEffect(() => {
    const handleCompletedChange = () => setCompletedTasks(getCompletedTasks());
    const handleAdsChange = () => {
      setAdsWatched(getAdsWatchedCount());
      setAdsClaimed(isAdsTaskClaimed());
    };
    const handlePendingChange = () => setPendingTasks(getPendingTasks());

    window.addEventListener('streetlife_tasks_completed_changed', handleCompletedChange);
    window.addEventListener('streetlife_ads_watched_changed', handleAdsChange);
    window.addEventListener('streetlife_pending_tasks_changed', handlePendingChange);

    return () => {
      window.removeEventListener('streetlife_tasks_completed_changed', handleCompletedChange);
      window.removeEventListener('streetlife_ads_watched_changed', handleAdsChange);
      window.removeEventListener('streetlife_pending_tasks_changed', handlePendingChange);
    };
  }, []);

  // Ad timer effect
  useEffect(() => {
    if (!isWatchingAdModalOpen) return;
    const interval = setInterval(() => {
      setAdTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsWatchingAdModalOpen(false);
          const nextCount = incrementAdsWatched();
          playSuccessSound();
          playCoinSound();
          onToast(`🎬 Ad finished! (${nextCount}/30 ads watched)`);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isWatchingAdModalOpen, onToast]);

  if (!isOpen) return null;

  // 1-6 Social Tasks List
  const ONE_TIME_TASKS = [
    {
      id: 'task_follow_x',
      title: 'Follow X Account',
      icon: <Twitter className="w-4 h-4 text-[#FFD700]" />,
      url: 'https://x.com/streethustle0?s=11',
      actionLabel: 'Follow',
    },
    {
      id: 'task_join_channel',
      title: 'Join Telegram Channel',
      icon: <Send className="w-4 h-4 text-cyan-400" />,
      url: 'https://t.me/Streethustlegame2',
      actionLabel: 'Join',
    },
    {
      id: 'task_join_group',
      title: 'Join Group Chat',
      icon: <Send className="w-4 h-4 text-sky-400" />,
      url: 'https://t.me/Streethustlechatroom',
      actionLabel: 'Join',
    },
    {
      id: 'task_payment_proof',
      title: 'Join Payment Proof Channel',
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
      url: 'https://t.me/Streethustlepaymentproof',
      actionLabel: 'Join',
    },
    {
      id: 'task_stars_group',
      title: 'Join Stars Group',
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      url: 'https://t.me/Streetlifestars',
      actionLabel: 'Join',
    },
    {
      id: 'task_sub_youtube',
      title: 'Subscribe YouTube Channel',
      icon: <Youtube className="w-4 h-4 text-red-500" />,
      url: 'https://youtube.com/@StreetLifeGame',
      actionLabel: 'Subscribe',
    },
  ];

  // Handle open external task link
  const handleOpenTaskLink = (taskId: string, url: string) => {
    playClickSound();
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    setClickedLinks((prev) => ({ ...prev, [taskId]: true }));
    onToast('Link opened in new tab! Tap Claim once completed.');
  };

  // Handle Claim One-Time 50 coins
  const handleClaimOneTime = (taskId: string, taskTitle: string) => {
    playClickSound();
    const success = markTaskCompleted(taskId, 50, taskTitle);
    if (success) {
      playSuccessSound();
      playCoinSound();
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
      triggerToast({
        type: 'success',
        title: 'Task Completed & Claimed',
        message: `+50 Street Coins have been added to your Net Worth for ${taskTitle}!`,
        reward: 50,
      });
      setCompletedTasks(getCompletedTasks());
    } else {
      triggerToast({
        type: 'error',
        title: 'Already Claimed',
        message: 'This one-time task has already been completed.',
      });
    }
  };

  // Handle Watch Ad
  const handleStartWatchAd = () => {
    playClickSound();
    if (adsWatched >= 30) {
      triggerToast({
        type: 'info',
        title: 'Ads Completed',
        message: 'You have already watched all 30 ads! Click Claim 3000 Coins.',
      });
      return;
    }
    setAdTimerSeconds(15);
    setIsWatchingAdModalOpen(true);
  };

  // Handle Claim 3000 Coins for Ads
  const handleClaimAdsReward = () => {
    playClickSound();
    if (adsWatched < 30) {
      triggerToast({
        type: 'info',
        title: 'Ads in Progress',
        message: `Watch all 30 ads first! Current progress: ${adsWatched}/30.`,
      });
      return;
    }
    const success = claimAdsTaskReward();
    if (success) {
      playSuccessSound();
      playCoinSound();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
      triggerToast({
        type: 'success',
        title: 'Jackbox Claimed! +3,000 SC',
        message: 'All 30 ads verified! 3,000 Street Coins credited to your Total Net Worth.',
        reward: 3000,
      });
      setAdsClaimed(true);
    }
  };

  // Handle Status Post Verification Submit
  const handleVerifyStatusPost = (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();

    const todayCount = getDailyTaskSubmissionCount('status_post');
    if (todayCount >= 2) {
      triggerToast({
        type: 'error',
        title: 'Daily Limit Reached',
        message: 'Maximum 2 Status Posts allowed per 24 hours. Resets tomorrow.',
      });
      return;
    }

    if (statusPlatform === 'whatsapp') {
      if (!statusScreenshot1 || !statusScreenshot2) {
        triggerToast({
          type: 'error',
          title: 'Missing Screenshots',
          message: 'Please upload both required screenshots (Status with link + handwritten date, and View count).',
        });
        return;
      }
    } else {
      if (!statusLinkInput.trim()) {
        triggerToast({
          type: 'error',
          title: 'Missing Status Link',
          message: 'Please paste your Telegram Status Link.',
        });
        return;
      }
      if (isLinkAlreadyUsed(statusLinkInput.trim())) {
        triggerToast({
          type: 'error',
          title: 'Link Already Used',
          message: 'This link has already been submitted by another player. Submit your own original proof.',
        });
        return;
      }
      if (!statusScreenshot1) {
        triggerToast({
          type: 'error',
          title: 'Missing Proof Screenshot',
          message: 'Please upload a screenshot showing today’s handwritten date.',
        });
        return;
      }
    }

    // Save duplicate check
    if (statusLinkInput.trim()) {
      recordUsedLink(statusLinkInput.trim());
    }

    const newPending: PendingTaskItem = {
      id: `pt_status_${Date.now()}`,
      playerId: 'usr_me',
      playerUsername: '@CurrentPlayer',
      type: 'status_post',
      subType: statusPlatform,
      status: 'pending',
      reward: 50,
      proofUrl: statusLinkInput.trim() || undefined,
      screenshot1: statusScreenshot1 || 'https://picsum.photos/seed/stat1/600/900',
      screenshot2: statusScreenshot2 || undefined,
      submittedAt: Date.now(),
      date: new Date().toISOString().split('T')[0],
    };

    const currentList = getPendingTasks();
    const updated = [newPending, ...currentList];
    savePendingTasks(updated);
    setPendingTasks(updated);

    playSuccessSound();
    triggerToast({
      type: 'pending',
      title: 'Status Post Submitted — PENDING',
      message: 'Your Status Post submission is now PENDING and will be reviewed by admin. Once approved, 50 SC will be credited directly to your balance!',
      reward: 50,
    });

    // Reset inputs
    setStatusLinkInput('');
    setStatusScreenshot1('');
    setStatusScreenshot2('');
  };

  // Handle Boost Channel Verification Submit
  const handleVerifyBoost = (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();

    const todayCount = getDailyTaskSubmissionCount('boost');
    if (todayCount >= 3) {
      triggerToast({
        type: 'error',
        title: 'Daily Limit Reached',
        message: 'Maximum 3 channel boosts allowed per 24 hours (3,000 SC/day).',
      });
      return;
    }

    if (!boostScreenshot) {
      triggerToast({
        type: 'error',
        title: 'Missing Boost Screenshot',
        message: 'Please upload a screenshot of your boost confirmation with today’s date written on paper.',
      });
      return;
    }

    const newPending: PendingTaskItem = {
      id: `pt_boost_${Date.now()}`,
      playerId: 'usr_me',
      playerUsername: '@CurrentPlayer',
      type: 'boost',
      subType: 'telegram',
      status: 'pending',
      reward: 1000,
      proofUrl: 'https://t.me/Streethustlegame2',
      screenshot1: boostScreenshot,
      submittedAt: Date.now(),
      date: new Date().toISOString().split('T')[0],
    };

    const currentList = getPendingTasks();
    const updated = [newPending, ...currentList];
    savePendingTasks(updated);
    setPendingTasks(updated);

    playSuccessSound();
    triggerToast({
      type: 'pending',
      title: 'Channel Boost Submitted — PENDING',
      message: 'Your Channel Boost submission is now PENDING. Admin will verify against the Telegram Boosters list. Once approved, 1,000 SC will be credited directly!',
      reward: 1000,
    });
    setBoostScreenshot('');
  };

  // Handle Video Auto-Check & Submit
  const handleVerifyVideo = (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();

    const url = videoLinkInput.trim();
    if (!url) {
      triggerToast({
        type: 'error',
        title: 'Missing Video Link',
        message: 'Please paste your TikTok or YouTube video link.',
      });
      return;
    }

    if (isLinkAlreadyUsed(url)) {
      triggerToast({
        type: 'error',
        title: 'Link Already Registered',
        message: 'This video link has already been verified globally by another player.',
      });
      return;
    }

    setVideoChecking(true);

    setTimeout(() => {
      setVideoChecking(false);
      const res = simulateAutoCheckVideo(url);
      setVideoFeedback({
        tested: true,
        qualified: res.qualified,
        likes: res.likes,
        views: res.views,
        hasHashtag: res.hasHashtag,
        message: res.message,
      });

      if (!res.validUrl) {
        triggerToast({
          type: 'error',
          title: 'Invalid Video Link',
          message: res.message,
        });
        return;
      }

      if (!res.qualified) {
        triggerToast({
          type: 'error',
          title: 'Video Not Qualified Yet',
          message: res.message,
        });
        return;
      }

      // Qualified! Record link and save to pending_tasks
      recordUsedLink(url);
      const isYoutube = url.toLowerCase().includes('youtube');

      const newPending: PendingTaskItem = {
        id: `pt_vid_${Date.now()}`,
        playerId: 'usr_me',
        playerUsername: '@CurrentPlayer',
        type: 'video',
        subType: isYoutube ? 'youtube' : 'tiktok',
        status: 'pending',
        reward: 2000,
        proofUrl: url,
        screenshot1: 'https://picsum.photos/seed/videothumb/800/600',
        stats: {
          likes: res.likes,
          views: res.views,
          hasHashtag: res.hasHashtag,
        },
        submittedAt: Date.now(),
        date: new Date().toISOString().split('T')[0],
      };

      const currentList = getPendingTasks();
      const updated = [newPending, ...currentList];
      savePendingTasks(updated);
      setPendingTasks(updated);

      playSuccessSound();
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      triggerToast({
        type: 'pending',
        title: 'Video Auto-Check Passed — PENDING',
        message: 'Your video passed auto-check (Likes & Views verified) and is now PENDING final review by admin. Once approved, 2,000 SC will be credited!',
        reward: 2000,
      });
      setVideoLinkInput('');
    }, 1200);
  };

  // Simulated screenshot selector helper
  const handleMockUpload = (setter: (val: string) => void, label: string) => {
    playClickSound();
    const mockImages = [
      'https://picsum.photos/seed/proofpaper1/600/900',
      'https://picsum.photos/seed/proofpaper2/600/900',
      'https://picsum.photos/seed/proofview3/600/900',
    ];
    const picked = mockImages[Math.floor(Math.random() * mockImages.length)];
    setter(picked);
    onToast(`📸 ${label} screenshot attached!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg rounded-3xl bg-[#121212] border-2 border-[#FFD700] p-4 sm:p-5 shadow-[0_0_35px_rgba(255,215,0,0.3)] flex flex-col max-h-[92vh] overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700] flex items-center justify-center text-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.3)]">
              <Coins className="w-5 h-5 fill-[#FFD700]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase text-white tracking-wider flex items-center gap-1.5">
                <span>TASKS - Earn Coins</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFD700] text-black font-extrabold">
                  10 TASKS ACTIVE
                </span>
              </h2>
              <p className="text-[10px] text-gray-400">
                Complete social steps, watch ads, and post content for huge SC rewards
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              playClickSound();
              onClose();
            }}
            type="button"
            className="w-8 h-8 rounded-full bg-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer active:scale-90 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* IN-MODAL TOAST NOTIFICATION FEEDBACK BANNER */}
        {inModalToast && (
          <div
            className={`my-2 p-3.5 rounded-2xl border-2 transition-all shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 relative overflow-hidden shrink-0 ${
              inModalToast.type === 'pending'
                ? 'bg-[#181408] border-[#FFD700] shadow-[0_0_25px_rgba(255,215,0,0.35)]'
                : inModalToast.type === 'success'
                ? 'bg-[#091a11] border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.35)]'
                : inModalToast.type === 'error'
                ? 'bg-[#1f0b0d] border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.35)]'
                : 'bg-[#0f172a] border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.35)]'
            }`}
          >
            <div className="flex items-start gap-3 relative z-10">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                  inModalToast.type === 'pending'
                    ? 'bg-[#FFD700] text-black'
                    : inModalToast.type === 'success'
                    ? 'bg-emerald-500 text-black'
                    : inModalToast.type === 'error'
                    ? 'bg-red-500 text-white'
                    : 'bg-cyan-500 text-black'
                }`}
              >
                {inModalToast.type === 'pending' ? (
                  <Clock className="w-5 h-5 animate-pulse" />
                ) : inModalToast.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : inModalToast.type === 'error' ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-2 mb-1">
                  {inModalToast.type === 'pending' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-[10px] font-black uppercase font-mono tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                      <span>PENDING REVIEW</span>
                    </span>
                  ) : inModalToast.type === 'success' ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase font-mono tracking-wider">
                      COMPLETED
                    </span>
                  ) : inModalToast.type === 'error' ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-black uppercase font-mono tracking-wider">
                      ATTENTION
                    </span>
                  ) : null}

                  {inModalToast.reward && (
                    <span className="text-[11px] font-mono font-bold text-[#FFD700]">
                      +{inModalToast.reward.toLocaleString()} SC
                    </span>
                  )}
                </div>

                <h4 className="text-xs font-black text-white leading-tight">
                  {inModalToast.title}
                </h4>
                <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
                  {inModalToast.message}
                </p>
              </div>

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={() => setInModalToast(null)}
                className="absolute top-0 right-0 p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Dismiss Feedback"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Tasks Body */}
        <div className="flex-1 overflow-y-auto space-y-4 my-3 pr-1">
          {/* ================================================================= */}
          {/* SECTION A: ONE-TIME 50 COINS (Tasks 1-6) */}
          {/* ================================================================= */}
          <div className="p-3.5 rounded-2xl bg-black/60 border border-[#FFD700]/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#FFD700]">
                  SECTION A: ONE-TIME 50 COINS
                </span>
                <span className="text-[9px] font-mono px-2 py-0.2 rounded bg-white/10 text-gray-300">
                  Instant Claim
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#FFD700] font-bold">
                +50 SC Each
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {ONE_TIME_TASKS.map((t, idx) => {
                const isClaimed = !!completedTasks[t.id];
                const isClicked = !!clickedLinks[t.id];

                return (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-xl bg-[#181818] border border-white/10 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate mr-2">
                      <div className="w-7 h-7 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center shrink-0">
                        {t.icon}
                      </div>
                      <div className="truncate">
                        <span className="font-bold text-white block truncate">
                          {idx + 1}. {t.title}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          Reward: +50 SC
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isClaimed ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase font-mono flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          COMPLETED
                        </span>
                      ) : isClicked ? (
                        <button
                          type="button"
                          onClick={() => handleClaimOneTime(t.id, t.title)}
                          className="px-3 py-1 rounded-lg bg-[#FFD700] hover:bg-[#FFD700]/90 text-black text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all shadow-md"
                        >
                          Claim 50
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenTaskLink(t.id, t.url)}
                          className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <span>{t.actionLabel}</span>
                          <ExternalLink className="w-3 h-3 text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================================================================= */}
          {/* SECTION B: WATCH ADS 3000 COINS (Task 7) */}
          {/* ================================================================= */}
          <div className="p-3.5 rounded-2xl bg-black/60 border border-[#FFD700]/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#FFD700]">
                  SECTION B: WATCH ADS 3000 COINS
                </span>
                <span className="text-[9px] font-mono px-2 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Task 7
                </span>
              </div>
              <span className="text-xs font-mono font-black text-[#FFD700]">
                {adsWatched}/30 Ads
              </span>
            </div>

            <p className="text-[11px] text-gray-300 leading-snug">
              Watch 30 sponsor advertisements to unlock the grand 3,000 SC treasure stash.
            </p>

            {/* Progress Bar: width = (count/30)*100 */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-gray-400">
                <span>Progress</span>
                <span className="text-white font-bold">{Math.round((adsWatched / 30) * 100)}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-black/80 border border-white/10 overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-yellow-500 via-[#FFD700] to-amber-400 transition-all duration-300 shadow-[0_0_10px_rgba(255,215,0,0.5)]"
                  style={{ width: `${(adsWatched / 30) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {adsClaimed ? (
                <div className="w-full py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-center font-black text-xs uppercase font-mono flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>COMPLETED FOREVER (+3,000 SC CREDITED)</span>
                </div>
              ) : adsWatched >= 30 ? (
                <button
                  type="button"
                  onClick={handleClaimAdsReward}
                  className="w-full py-2.5 rounded-xl bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Coins className="w-4 h-4 fill-black" />
                  <span>Claim 3000 Coins Now</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartWatchAd}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-[#FFD700] text-black font-black text-xs uppercase tracking-wider shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Tv className="w-4 h-4" />
                  <span>Watch Ad ({adsWatched}/30)</span>
                </button>
              )}
            </div>
          </div>

          {/* ================================================================= */}
          {/* SECTION C: DAILY TASKS (Tasks 8 & 9) */}
          {/* ================================================================= */}
          <div className="p-3.5 rounded-2xl bg-black/60 border border-[#FFD700]/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-[#FFD700]">
                SECTION C: DAILY TASKS (PROOF &amp; ADMIN VERIFIED)
              </span>
              <span className="text-[10px] font-mono text-amber-300">Resets 24hrs</span>
            </div>

            {/* TASK 8: STATUS POST (50 per post, 2 times daily) */}
            <div className="p-3 rounded-xl bg-[#181818] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-white uppercase">
                    8. Status Post (50 SC per post • Max 2/day)
                  </h4>
                  <p className="text-[10px] text-gray-400">
                    Post our link on WhatsApp or Telegram Status with today’s date
                  </p>
                </div>
                <span className="text-[10px] font-mono text-[#FFD700] font-bold">
                  {getDailyTaskSubmissionCount('status_post')}/2 Today
                </span>
              </div>

              {/* Platform Switch */}
              <div className="flex rounded-xl bg-black/60 p-1 border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusPlatform('whatsapp')}
                  className={`flex-1 py-1 rounded-lg font-bold transition-all ${
                    statusPlatform === 'whatsapp'
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  WhatsApp Status
                </button>
                <button
                  type="button"
                  onClick={() => setStatusPlatform('telegram')}
                  className={`flex-1 py-1 rounded-lg font-bold transition-all ${
                    statusPlatform === 'telegram'
                      ? 'bg-[#0088cc] text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Telegram Status
                </button>
              </div>

              <form onSubmit={handleVerifyStatusPost} className="space-y-2">
                {statusPlatform === 'whatsapp' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleMockUpload(setStatusScreenshot1, 'Screenshot 1 (Status + Date)')
                      }
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        statusScreenshot1
                          ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                          : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5 mx-auto mb-1" />
                      <span className="text-[9px] font-bold block leading-tight">
                        {statusScreenshot1 ? 'Screenshot 1 Attached ✓' : 'Upload Status + Paper Date'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleMockUpload(setStatusScreenshot2, 'Screenshot 2 (View Count)')
                      }
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        statusScreenshot2
                          ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                          : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5 mx-auto mb-1" />
                      <span className="text-[9px] font-bold block leading-tight">
                        {statusScreenshot2 ? 'Screenshot 2 Attached ✓' : 'Upload View Count'}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Paste Telegram Status Link"
                      value={statusLinkInput}
                      onChange={(e) => setStatusLinkInput(e.target.value)}
                      className="w-full bg-black/60 border border-white/15 focus:border-[#FFD700] rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleMockUpload(setStatusScreenshot1, 'Telegram Screenshot + Date')
                      }
                      className={`w-full p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        statusScreenshot1
                          ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                          : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <span className="text-[10px] font-bold">
                        {statusScreenshot1
                          ? 'Screenshot with Date Attached ✓'
                          : 'Upload Screenshot with Today’s Date'}
                      </span>
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2 rounded-xl bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-md"
                >
                  Verify Status Post
                </button>
              </form>
            </div>

            {/* TASK 9: BOOST CHANNEL (1000 per boost, 3 times daily) */}
            <div className="p-3 rounded-xl bg-[#181818] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-white uppercase">
                    9. Boost Channel (1,000 SC per boost • Max 3/day)
                  </h4>
                  <p className="text-[10px] text-gray-400">
                    Boost Telegram Channel &amp; upload proof with today’s written date
                  </p>
                </div>
                <span className="text-[10px] font-mono text-[#FFD700] font-bold">
                  {getDailyTaskSubmissionCount('boost')}/3 Today
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-black/50 border border-white/10 text-xs">
                <span className="text-gray-300">https://t.me/Streethustlegame2</span>
                <a
                  href="https://t.me/Streethustlegame2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1 hover:brightness-110"
                >
                  <span>Boost</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <form onSubmit={handleVerifyBoost} className="space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    handleMockUpload(setBoostScreenshot, 'Boost Confirmation with Date')
                  }
                  className={`w-full p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    boostScreenshot
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                      : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5 mx-auto mb-1" />
                  <span className="text-[10px] font-bold block">
                    {boostScreenshot
                      ? 'Boost Confirmation with Date Attached ✓'
                      : 'Upload Screenshot of Boost Confirmation (with today’s paper date)'}
                  </span>
                </button>

                <button
                  type="submit"
                  className="w-full py-2 rounded-xl bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-md"
                >
                  Verify Channel Boost
                </button>
              </form>
            </div>
          </div>

          {/* ================================================================= */}
          {/* SECTION D: VIDEO TASK - ACTIVE NOW (Task 10) */}
          {/* ================================================================= */}
          <div className="p-3.5 rounded-2xl bg-black/60 border-2 border-[#FFD700] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Video className="w-4 h-4 text-[#FFD700]" />
                <span className="text-xs font-black uppercase tracking-wider text-[#FFD700]">
                  SECTION D: VIDEO TASK (ACTIVE NOW • 2,000 SC)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase font-mono">
                LIVE
              </span>
            </div>

            <p className="text-[11px] text-gray-300 leading-snug">
              Make video about Street Hustle Game (must say &quot;Street Hustle&quot; or show gameplay 5 secs, min 100 likes &amp; 1,000 views).
            </p>

            <form onSubmit={handleVerifyVideo} className="space-y-2">
              <input
                type="text"
                placeholder="Paste TikTok or YouTube video link"
                value={videoLinkInput}
                onChange={(e) => setVideoLinkInput(e.target.value)}
                className="w-full bg-black/70 border border-white/15 focus:border-[#FFD700] rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none"
              />

              <button
                type="submit"
                disabled={videoChecking}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FFD700] to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {videoChecking ? (
                  <span>Checking Video Stats...</span>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-black" />
                    <span>Auto-Check &amp; Verify Video</span>
                  </>
                )}
              </button>
            </form>

            {/* Video Auto-Check Live Stats Feedback */}
            {videoFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs font-mono space-y-1.5 ${
                  videoFeedback.qualified
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                    : 'bg-red-950/40 border-red-500/50 text-red-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>Likes: {videoFeedback.likes}/100</span>
                  <span>{videoFeedback.likes >= 100 ? '✅' : '❌'}</span>
                </div>
                <div className="flex items-center justify-between font-bold">
                  <span>Views: {videoFeedback.views}/1000</span>
                  <span>{videoFeedback.views >= 1000 ? '✅' : '❌'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Has #StreetHustle:</span>
                  <span>{videoFeedback.hasHashtag ? 'Yes ✅' : 'No ❌'}</span>
                </div>
                <p className="pt-1 border-t border-white/10 text-[10px] leading-tight font-sans">
                  {videoFeedback.message}
                </p>
              </div>
            )}
          </div>

          {/* Pending Submissions Feed */}
          {pendingTasks.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">
                Your Submitted Tasks Status:
              </span>
              <div className="space-y-1.5">
                {pendingTasks.slice(0, 4).map((pt) => (
                  <div
                    key={pt.id}
                    className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block capitalize">
                        {pt.type.replace('_', ' ')} (+{pt.reward} SC)
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        Date: {pt.date}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase font-mono ${
                        pt.status === 'pending'
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                          : pt.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-red-500/20 text-red-300 border border-red-500/40'
                      }`}
                    >
                      {pt.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Close */}
        <div className="pt-3 border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
          >
            Close Tasks
          </button>
        </div>
      </div>

      {/* AD TIMER SIMULATION MODAL */}
      {isWatchingAdModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs rounded-2xl bg-[#151515] border-2 border-[#FFD700] p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700] flex items-center justify-center text-[#FFD700] mx-auto">
              <Tv className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Watching Sponsor Ad...
              </h3>
              <p className="text-2xl font-black font-mono text-[#FFD700] mt-1">
                {adTimerSeconds}s
              </p>
            </div>

            <p className="text-[11px] text-gray-400">
              Please watch the full ad to increment your 30 Ads reward counter.
            </p>

            <button
              type="button"
              onClick={() => {
                // Quick complete button for convenience
                setIsWatchingAdModalOpen(false);
                const nextCount = incrementAdsWatched();
                playSuccessSound();
                onToast(`🎬 Ad completed! (${nextCount}/30 ads)`);
              }}
              className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 text-xs font-bold"
            >
              Skip / Complete Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TasksEarnCoinsModal;
