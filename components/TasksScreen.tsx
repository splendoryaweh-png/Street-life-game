'use client';

import React, { useState, useEffect } from 'react';
import {
  UserGameState,
  TaskCategory,
  NavTab,
} from '@/types/game';
import {
  completeTask,
  claimStatusPostTask,
  submitVideoPromoTask,
  openMysteryBox,
  addInGameStayTime,
  updateTaskProgressMetrics,
} from '@/lib/storage';
import { recordSimulatedUserBoost } from '@/lib/telegram';
import { playClickSound, playCoinSound } from '@/lib/sound';
import confetti from 'canvas-confetti';
import {
  Send,
  MessageSquare,
  ShieldCheck,
  Video,
  Youtube,
  Twitter,
  Flame,
  Share2,
  Users,
  Copy,
  Check,
  CheckCircle2,
  Tv,
  Clock,
  Swords,
  Trophy,
  Wallet,
  Star,
  Gift,
  Calendar,
  HelpCircle,
  Sparkles,
  ExternalLink,
  Upload,
  ArrowRight,
  ArrowLeft,
  Zap,
} from 'lucide-react';

interface TasksScreenProps {
  gameState: UserGameState;
  onToast: (msg: string) => void;
  onNavigateTab?: (tab: NavTab) => void;
  onBack?: () => void;
}

const CATEGORIES: TaskCategory[] = [
  'Social',
  'Boost',
  'Promotion',
  'Referral',
  'Watch',
  'Stay',
  'Play',
  'Earn',
  'Daily',
  'Other',
];

const OFFICIAL_LINKS = {
  mainChannel: 'https://t.me/Streethustlegame2',
  chatGroup: 'https://t.me/Streethustlechatroom',
  paymentProof: 'https://t.me/Streethustlepaymentproof',
  tiktok: 'https://www.tiktok.com/@streetlife737',
  youtube: 'https://youtube.com/@streetlife22',
  x: 'https://x.com/streethustle0',
  gameLink: 'https://t.me/Streethustlegame2',
};

// Context for broadcasting which task cards should play the subtle shake animation
const ShakingTasksContext = React.createContext<Record<string, boolean>>({});

export function TasksScreen({ gameState, onToast, onNavigateTab, onBack }: TasksScreenProps) {
  const [activeCategory, setActiveCategory] = useState<TaskCategory>('Social');
  const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null);
  const [shakingTaskIds, setShakingTaskIds] = useState<Record<string, boolean>>({});

  // Modals for special tasks
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusScreenshotProof, setStatusScreenshotProof] = useState<string>('');
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0);
  const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [mysteryReward, setMysteryReward] = useState<number | null>(null);

  const completed = gameState.completedTasks || {};
  const metrics = gameState.taskProgress || {
    stayTimeSeconds: 0,
    adsWatchedTotal: 5,
    wheelSpinsTotal: 0,
    statusPostsToday: 0,
    videoPromoSubmitted: 0,
    racesWon: 0,
    beefWon: 0,
    turfWarsWon: 0,
    cribTier: 0,
    walletConnected: 0,
    firstWithdrawBonusClaimed: 0,
    mysteryBoxOpenedToday: 0,
    dailyQuizAnswersToday: 0,
  };

  // Active stay timer: increments every 5 seconds when tasks tab is open
  useEffect(() => {
    const timer = setInterval(() => {
      addInGameStayTime(5);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Trigger subtle shake animation on task items and a minor confetti burst using canvas-confetti
  const triggerTaskShakeAndConfetti = (taskId: string, targetEl?: HTMLElement | null) => {
    // 1. Mark task card for subtle shake animation
    setShakingTaskIds((prev) => ({ ...prev, [taskId]: true }));
    setTimeout(() => {
      setShakingTaskIds((prev) => {
        if (!prev[taskId]) return prev;
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }, 700);

    // 2. Derive origin for the minor confetti burst from the task element if available
    let origin: { x: number; y: number } = { x: 0.5, y: 0.6 };
    try {
      const el =
        targetEl ||
        (typeof document !== 'undefined'
          ? document.getElementById(`task-item-${taskId}`)
          : null);
      if (el && typeof window !== 'undefined') {
        const rect = el.getBoundingClientRect();
        origin = {
          x: Math.max(0.15, Math.min(0.85, (rect.left + rect.width / 2) / window.innerWidth)),
          y: Math.max(0.15, Math.min(0.85, (rect.top + rect.height / 2) / window.innerHeight)),
        };
      }
    } catch {}

    // 3. Trigger minor confetti burst using canvas-confetti
    try {
      confetti({
        particleCount: 38,
        spread: 52,
        startVelocity: 22,
        ticks: 120,
        gravity: 1.1,
        scalar: 0.8,
        origin,
        colors: ['#FFD700', '#FFA500', '#10B981', '#FFFFFF', '#60A5FA'],
        shapes: ['circle', 'square'],
        disableForReducedMotion: true,
      });
    } catch (err) {
      console.warn('Minor confetti error:', err);
    }
  };

  // Helper to complete task with shake and minor confetti burst
  const handleClaim = (
    taskId: string,
    reward: number,
    title: string,
    proof?: string,
    targetEl?: HTMLElement | null
  ) => {
    playClickSound();
    const res = completeTask(taskId, reward, title, proof);
    if (res.success) {
      playCoinSound();
      triggerTaskShakeAndConfetti(taskId, targetEl);
      onToast(res.message);
    } else {
      onToast(res.message);
    }
  };

  // Open link and start verification countdown
  const handleOpenAndVerify = (
    taskId: string,
    reward: number,
    title: string,
    url: string,
    targetEl?: HTMLElement | null
  ) => {
    playClickSound();
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // fallback
    }

    setVerifyingTaskId(taskId);
    onToast(`Verifying membership on ${title}...`);

    if (taskId === 'boost_main_channel') {
      recordSimulatedUserBoost(gameState.telegramUser?.id || gameState.deviceId, 'main');
    } else if (taskId === 'boost_proof_channel') {
      recordSimulatedUserBoost(gameState.telegramUser?.id || gameState.deviceId, 'proof');
    }

    setTimeout(() => {
      setVerifyingTaskId(null);
      handleClaim(taskId, reward, title, undefined, targetEl);
    }, 3000);
  };

  const handleCopyReferral = () => {
    playClickSound();
    const inviteLink = `${OFFICIAL_LINKS.gameLink}?start=${gameState.myReferralCode || 'SL7K9B2'}`;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(inviteLink);
      setCopiedReferral(true);
      onToast('Referral link copied to clipboard!');
      setTimeout(() => setCopiedReferral(false), 2500);
    }
  };

  const handleStatusSubmit = () => {
    playClickSound();
    const res = claimStatusPostTask(statusScreenshotProof || 'screenshot_status_verified.png');
    if (res.success) {
      playCoinSound();
      triggerTaskShakeAndConfetti('promotion_status');
      onToast(res.message);
      setShowStatusModal(false);
      setStatusScreenshotProof('');
    } else {
      onToast(res.message);
    }
  };

  const handleVideoSubmit = () => {
    playClickSound();
    if (!videoUrlInput || videoUrlInput.length < 5) {
      onToast('Please enter a valid video link.');
      return;
    }
    const lower = videoUrlInput.toLowerCase();
    if (lower.includes('instagram.com') || lower.includes('instagr.am')) {
      onToast('Instagram is NOT allowed. Post on TikTok, YouTube or Facebook!');
      return;
    }

    const res = submitVideoPromoTask(videoUrlInput);
    if (res.success) {
      playCoinSound();
      triggerTaskShakeAndConfetti('promotion_video');
      onToast(res.message);
      setShowVideoModal(false);
      setVideoUrlInput('');
    } else {
      onToast(res.message);
    }
  };

  const handleOpenMysteryBox = () => {
    playClickSound();
    const res = openMysteryBox();
    if (res.success) {
      playCoinSound();
      triggerTaskShakeAndConfetti('mystery_box');
      setMysteryReward(res.reward);
      onToast(res.message);
    } else {
      onToast(res.message);
    }
  };

  // Street Quiz dataset
  const QUIZ_QUESTIONS = [
    {
      q: 'What is the main cryptocurrency used for Play-to-Earn payouts in STREET LIFE?',
      options: ['TON Network', 'Dogecoin', 'Monero', 'Shiba Inu'],
      correct: 0,
    },
    {
      q: 'Which weapon deals Legendary damage in the street armory?',
      options: ['Water Gun', 'AK-47', 'Slingshot', 'Baseball Bat'],
      correct: 1,
    },
    {
      q: 'What is the maximum daily ads you can watch for rewards?',
      options: ['3 Ads', '5 Ads', '10 Ads', '50 Ads'],
      correct: 2,
    },
  ];

  const handleAnswerQuiz = () => {
    if (quizSelectedOption === null) return;
    const currentQ = QUIZ_QUESTIONS[quizQuestionIndex];
    if (quizSelectedOption === currentQ.correct) {
      playCoinSound();
      triggerTaskShakeAndConfetti('daily_quiz');
      const nextAnswers = (metrics.dailyQuizAnswersToday || 0) + 1;
      updateTaskProgressMetrics({
        dailyQuizAnswersToday: nextAnswers,
      });
      completeTask(`quiz_answer_${quizQuestionIndex}_${Date.now()}`, 100, `Street Quiz Question #${quizQuestionIndex + 1}`);
      onToast('Correct! +100 SC awarded!');
      if (quizQuestionIndex + 1 < QUIZ_QUESTIONS.length) {
        setQuizQuestionIndex(quizQuestionIndex + 1);
        setQuizSelectedOption(null);
      } else {
        setShowQuizModal(false);
        setQuizQuestionIndex(0);
        setQuizSelectedOption(null);
      }
    } else {
      onToast('Incorrect answer! Try again.');
    }
  };

  // Convert stay seconds into readable H:M:S
  const formatSeconds = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m ${secs}s`;
  };

  return (
    <ShakingTasksContext.Provider value={shakingTaskIds}>
      <div className="w-full min-h-[calc(100dvh-5rem)] flex-1 overflow-y-auto pb-40 pt-4 px-4 overscroll-contain select-none flex flex-col space-y-4 animate-fadeIn">
      {/* HEADER */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <button
              onClick={() => {
                playClickSound();
                onBack();
              }}
              type="button"
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-[#FFD700] cursor-pointer shrink-0"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#FFD700] bg-[#FFD700]/10 px-2 py-0.5 rounded border border-[#FFD700]/30">
                PROMPT 6 SYSTEM
              </span>
              <span className="text-[11px] text-[#9CA3AF] font-bold">Play to Earn TON</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase mt-0.5">
              STREET BOUNTIES &amp; TASKS
            </h1>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-[#9CA3AF] font-bold uppercase">Balance</div>
          <div className="text-sm font-black text-[#FFD700]">
            {(gameState.streetCoin || 0).toLocaleString()} SC
          </div>
        </div>
      </div>

      {/* 1. HORIZONTAL TABS ORDER (Scrollable row) */}
      {/* Order: [ Social | Boost | Promotion | Referral | Watch | Stay | Play | Earn | Daily | Other ] */}
      <div className="relative -mx-2 px-2 border-b border-white/10 pb-1">
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar scroll-smooth py-1">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  playClickSound();
                  setActiveCategory(cat);
                }}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all relative cursor-pointer touch-manipulation ${
                  isActive
                    ? 'bg-[#FFD700] text-black shadow-[0_0_12px_rgba(255,215,0,0.5)] font-black'
                    : 'bg-[#151515] text-[#9CA3AF] hover:text-white border border-white/10'
                }`}
              >
                {cat}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-[#FFD700] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. VERTICAL TASKS LIST BELOW */}
      <div className="flex flex-col space-y-3">
        {/* ========================================================================= */}
        {/* TAB 1: SOCIAL TASKS */}
        {/* ========================================================================= */}
        {activeCategory === 'Social' && (
          <>
            <div className="text-[11px] font-bold text-[#9CA3AF] px-1">
              Join & follow our verified platforms to earn instant StreetCoins:
            </div>

            {/* 1. Join Main Channel */}
            <TaskCard
              id="social_main_channel"
              title="Join Main Channel"
              reward={100}
              desc="Official announcements & release drops"
              link={OFFICIAL_LINKS.mainChannel}
              icon={Send}
              isCompleted={!!completed['social_main_channel']}
              isVerifying={verifyingTaskId === 'social_main_channel'}
              onAction={() =>
                handleOpenAndVerify(
                  'social_main_channel',
                  100,
                  'Main Channel',
                  OFFICIAL_LINKS.mainChannel
                )
              }
            />

            {/* 2. Join Chat Group */}
            <TaskCard
              id="social_chat_group"
              title="Join Chat Group"
              reward={100}
              desc="Talk strategy with thousands of hustlers"
              link={OFFICIAL_LINKS.chatGroup}
              icon={MessageSquare}
              isCompleted={!!completed['social_chat_group']}
              isVerifying={verifyingTaskId === 'social_chat_group'}
              onAction={() =>
                handleOpenAndVerify(
                  'social_chat_group',
                  100,
                  'Chat Group',
                  OFFICIAL_LINKS.chatGroup
                )
              }
            />

            {/* 3. Join Payment Proof */}
            <TaskCard
              id="social_payment_proof"
              title="Join Payment Proof"
              reward={100}
              desc="Real verified TON payment transactions"
              link={OFFICIAL_LINKS.paymentProof}
              icon={ShieldCheck}
              isCompleted={!!completed['social_payment_proof']}
              isVerifying={verifyingTaskId === 'social_payment_proof'}
              onAction={() =>
                handleOpenAndVerify(
                  'social_payment_proof',
                  100,
                  'Payment Proof Channel',
                  OFFICIAL_LINKS.paymentProof
                )
              }
            />

            {/* 4. Follow TikTok */}
            <TaskCard
              id="social_tiktok"
              title="Follow TikTok"
              reward={100}
              desc="@streetlife737 official viral clips"
              link={OFFICIAL_LINKS.tiktok}
              icon={Video}
              isCompleted={!!completed['social_tiktok']}
              isVerifying={verifyingTaskId === 'social_tiktok'}
              onAction={() =>
                handleOpenAndVerify('social_tiktok', 100, 'TikTok', OFFICIAL_LINKS.tiktok)
              }
            />

            {/* 5. Subscribe YouTube */}
            <TaskCard
              id="social_youtube"
              title="Subscribe YouTube"
              reward={100}
              desc="@streetlife22 game tutorials & podcasts"
              link={OFFICIAL_LINKS.youtube}
              icon={Youtube}
              isCompleted={!!completed['social_youtube']}
              isVerifying={verifyingTaskId === 'social_youtube'}
              onAction={() =>
                handleOpenAndVerify('social_youtube', 100, 'YouTube', OFFICIAL_LINKS.youtube)
              }
            />

            {/* 6. Follow X */}
            <TaskCard
              id="social_x"
              title="Follow X / Twitter"
              reward={100}
              desc="@streethustle0 breaking news & giveaways"
              link={OFFICIAL_LINKS.x}
              icon={Twitter}
              isCompleted={!!completed['social_x']}
              isVerifying={verifyingTaskId === 'social_x'}
              onAction={() =>
                handleOpenAndVerify('social_x', 100, 'X', OFFICIAL_LINKS.x)
              }
            />
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: BOOST TASKS */}
        {/* ========================================================================= */}
        {activeCategory === 'Boost' && (
          <>
            <div className="text-[11px] font-bold text-[#9CA3AF] px-1">
              Boost our Telegram channels with Telegram Stars / Boosts to unlock high rewards:
            </div>

            <TaskCard
              id="boost_main_channel"
              title="Boost Main Channel"
              reward={5000}
              desc="Boost https://t.me/Streethustlegame2 with Telegram Premium boost"
              link={OFFICIAL_LINKS.mainChannel}
              icon={Flame}
              badge="5,000 SC"
              buttonLabel="Boost Channel"
              isCompleted={!!completed['boost_main_channel']}
              isVerifying={verifyingTaskId === 'boost_main_channel'}
              onAction={() =>
                handleOpenAndVerify(
                  'boost_main_channel',
                  5000,
                  'Boost Main Channel',
                  'https://t.me/boost/Streethustlegame2'
                )
              }
            />

            <TaskCard
              id="boost_proof_channel"
              title="Boost Proof Channel"
              reward={5000}
              desc="Boost https://t.me/Streethustlepaymentproof"
              link={OFFICIAL_LINKS.paymentProof}
              icon={Flame}
              badge="5,000 SC"
              buttonLabel="Boost Channel"
              isCompleted={!!completed['boost_proof_channel']}
              isVerifying={verifyingTaskId === 'boost_proof_channel'}
              onAction={() =>
                handleOpenAndVerify(
                  'boost_proof_channel',
                  5000,
                  'Boost Proof Channel',
                  'https://t.me/boost/Streethustlepaymentproof'
                )
              }
            />
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PROMOTION TASKS */}
        {/* ========================================================================= */}
        {activeCategory === 'Promotion' && (
          <>
            {/* Task A: Status Post */}
            <div
              id="task-item-promotion_status"
              className={`bg-[#121212] border border-[#FFD700]/30 rounded-2xl p-4 space-y-3 transition-all ${
                shakingTaskIds['promotion_status'] ? 'animate-subtle-shake ring-1 ring-[#FFD700]/60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/40 flex items-center justify-center text-[#FFD700]">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Post Link on Your Status</h3>
                    <p className="text-[11px] text-[#9CA3AF] leading-tight mt-0.5">
                      Post {OFFICIAL_LINKS.gameLink} on your WhatsApp or Telegram Status
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#FFD700]/20 text-[#FFD700] text-xs font-black">
                  Up to 150 SC
                </span>
              </div>

              <div className="text-xs bg-[#1A1A1A] p-2.5 rounded-xl border border-white/5 space-y-1">
                <div className="flex justify-between text-[#9CA3AF]">
                  <span>1st Post Today:</span>
                  <span className="text-[#FFD700] font-bold">+50 SC</span>
                </div>
                <div className="flex justify-between text-[#9CA3AF]">
                  <span>2nd Post Today:</span>
                  <span className="text-[#FFD700] font-bold">+100 SC</span>
                </div>
                <div className="text-[10px] text-amber-400 font-medium pt-1 border-t border-white/5">
                  Rule: Max 2 times per day only. Upload screenshot proof for admin verification.
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="text-xs font-bold text-[#9CA3AF]">
                  Today: <span className="text-white">{metrics.statusPostsToday || 0}/2 Posted</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setShowStatusModal(true);
                  }}
                  disabled={(metrics.statusPostsToday || 0) >= 2}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                    (metrics.statusPostsToday || 0) >= 2
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-[#FFD700] text-black hover:bg-yellow-400 active:scale-95 shadow-[0_0_10px_rgba(255,215,0,0.4)]'
                  }`}
                >
                  {(metrics.statusPostsToday || 0) >= 2 ? 'Daily Max Reached' : 'Submit Proof'}
                </button>
              </div>
            </div>

            {/* Task B: Video Promo Task */}
            <div
              id="task-item-promotion_video"
              className={`bg-[#121212] border border-white/10 rounded-2xl p-4 space-y-3 transition-all ${
                shakingTaskIds['promotion_video'] ? 'animate-subtle-shake ring-1 ring-purple-500/60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Make Video About STREET LIFE</h3>
                    <p className="text-[11px] text-[#9CA3AF] leading-tight mt-0.5">
                      Talk about Street Life game on TikTok, Facebook or YouTube ONLY
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-xs font-black">
                  200 SC
                </span>
              </div>

              <div className="text-[11px] text-[#9CA3AF] bg-[#1A1A1A] p-2.5 rounded-xl border border-white/5 space-y-1">
                <p>• Allowed Platforms: <strong>TikTok, Facebook, YouTube ONLY</strong> (Instagram NOT allowed).</p>
                <p>• Criteria: Minimum <strong>1,000 views + 100 likes</strong>.</p>
                <p>• Reward: Fixed at <strong>200 SC per approved video</strong>.</p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="text-xs font-bold text-[#9CA3AF]">
                  Status: {completed['video_promo_task'] ? (
                    <span className="text-emerald-400">Verified ✓</span>
                  ) : metrics.videoPromoSubmitted ? (
                    <span className="text-amber-400">Under Review</span>
                  ) : (
                    <span className="text-zinc-500">Not Submitted</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setShowVideoModal(true);
                  }}
                  disabled={!!completed['video_promo_task']}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                    completed['video_promo_task']
                      ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 cursor-not-allowed'
                      : 'bg-[#FFD700] text-black hover:bg-yellow-400 active:scale-95 shadow-[0_0_10px_rgba(255,215,0,0.4)]'
                  }`}
                >
                  {completed['video_promo_task'] ? 'Claimed ✓' : 'Submit Video Link'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: REFERRAL TASKS */}
        {/* ========================================================================= */}
        {activeCategory === 'Referral' && (
          <>
            {/* Referral Dashboard Card */}
            <div className="bg-[#121212] border border-[#FFD700]/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white uppercase">Your Referral Hub</h3>
                  <p className="text-[11px] text-[#9CA3AF]">Earn 500 SC for every hustler you bring in</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/40 flex items-center justify-center text-[#FFD700]">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#1A1A1A] p-2.5 rounded-xl border border-white/5">
                  <div className="text-[10px] text-[#9CA3AF] uppercase font-bold">Total Invites</div>
                  <div className="text-lg font-black text-white mt-0.5">
                    {gameState.referralsCount || 0}
                  </div>
                </div>
                <div className="bg-[#1A1A1A] p-2.5 rounded-xl border border-white/5">
                  <div className="text-[10px] text-[#9CA3AF] uppercase font-bold">Total Earned</div>
                  <div className="text-lg font-black text-[#FFD700] mt-0.5">
                    {((gameState.referralsCount || 0) * 500).toLocaleString()} SC
                  </div>
                </div>
              </div>

              {/* Copy link */}
              <div className="flex items-center space-x-2 bg-[#1A1A1A] p-2 rounded-xl border border-white/10">
                <span className="text-xs text-[#9CA3AF] truncate flex-1 font-mono pl-1">
                  {OFFICIAL_LINKS.gameLink}?start={gameState.myReferralCode || 'SL7K9B2'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyReferral}
                  className="px-3 py-1.5 rounded-lg bg-[#FFD700] text-black font-black text-xs flex items-center gap-1 active:scale-95"
                >
                  {copiedReferral ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedReferral ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Milestones */}
            <TaskCard
              id="ref_milestone_1"
              title="Refer 1 Person"
              reward={500}
              desc="Invite your first crew member to Street Life"
              icon={Users}
              isCompleted={!!completed['ref_milestone_1'] || (gameState.referralsCount || 0) >= 1}
              onAction={() => handleClaim('ref_milestone_1', 500, 'Refer 1 Person')}
            />

            <TaskCard
              id="ref_milestone_2"
              title="Refer 2 People"
              reward={1000}
              desc="Build a 2-man syndicate"
              icon={Users}
              isCompleted={!!completed['ref_milestone_2'] || (gameState.referralsCount || 0) >= 2}
              onAction={() => handleClaim('ref_milestone_2', 1000, 'Refer 2 People')}
            />

            <TaskCard
              id="ref_milestone_3"
              title="Refer 3 People"
              reward={1500}
              desc="Continue earning +500 SC per referral after this!"
              icon={Users}
              isCompleted={!!completed['ref_milestone_3'] || (gameState.referralsCount || 0) >= 3}
              onAction={() => handleClaim('ref_milestone_3', 1500, 'Refer 3 People')}
            />
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: WATCH TASKS */}
        {/* ========================================================================= */}
        {activeCategory === 'Watch' && (
          <>
            <div
              id="task-item-watch_10_ads_task"
              className={`bg-[#121212] border border-white/10 rounded-2xl p-4 space-y-3 transition-all ${
                shakingTaskIds['watch_10_ads_task'] ? 'animate-subtle-shake ring-1 ring-emerald-500/60' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white">Watch 10 Ads Milestone</h3>
                  <p className="text-[11px] text-[#9CA3AF]">
                    Watch rewarded ads in the Watch tab to collect 500 SC bonus
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#FFD700]/20 text-[#FFD700] text-xs font-black">
                  500 SC
                </span>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[#9CA3AF]">Progress</span>
                  <span className="text-[#FFD700]">{Math.min(10, gameState.watchCountDaily || 0)} / 10</span>
                </div>
                <div className="w-full bg-[#1A1A1A] h-2.5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-500 to-[#FFD700] transition-all"
                    style={{ width: `${Math.min(100, ((gameState.watchCountDaily || 0) / 10) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => onNavigateTab && onNavigateTab('WATCH')}
                  className="px-4 py-2 rounded-xl bg-[#FFD700] text-black font-black text-xs uppercase flex items-center gap-1 active:scale-95 cursor-pointer"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>Go to Watch Tab</span>
                </button>

                {(gameState.watchCountDaily || 0) >= 10 && !completed['watch_10_ads_task'] && (
                  <button
                    type="button"
                    onClick={(e) =>
                      handleClaim(
                        'watch_10_ads_task',
                        500,
                        'Watch 10 Ads',
                        undefined,
                        e.currentTarget
                      )
                    }
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-black text-xs uppercase active:scale-95 shadow-[0_0_10px_rgba(16,185,129,0.5)] cursor-pointer"
                  >
                    Claim 500 SC
                  </button>
                )}
                {completed['watch_10_ads_task'] && (
                  <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Claimed
                  </span>
                )}
              </div>
            </div>

            <TaskCard
              id="spin_wheel_5"
              title="Spin Wheel 5 Times"
              reward={100}
              desc="Spin the daily wheel 5 times to claim bonus"
              icon={Sparkles}
              isCompleted={!!completed['spin_wheel_5']}
              buttonLabel="Go to Spin"
              onAction={() => handleClaim('spin_wheel_5', 100, 'Spin Wheel 5 Times')}
            />
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: STAY TASKS */}
        {/* ========================================================================= */}
        {activeCategory === 'Stay' && (
          <>
            <div className="bg-[#121212] border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white">In-Game Active Time</h3>
                  <p className="text-[11px] text-[#9CA3AF]">
                    Stay actively engaged in the app to accumulate StreetCoins
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[#9CA3AF] uppercase font-bold">Current Session</div>
                  <div className="text-xs font-black text-[#FFD700]">
                    {formatSeconds(metrics.stayTimeSeconds || 0)}
                  </div>
                </div>
              </div>
            </div>

            <TaskCard
              id="stay_1_hour"
              title="Stay in Game for 1 Hour"
              reward={100}
              desc="Session progress: 3,600 seconds"
              icon={Clock}
              isCompleted={!!completed['stay_1_hour']}
              progress={`${Math.min(3600, metrics.stayTimeSeconds || 0)} / 3600s`}
              onAction={() => handleClaim('stay_1_hour', 100, 'Stay in Game for 1 Hour')}
            />

            <TaskCard
              id="stay_3_hours"
              title="Stay for 3 Hours"
              reward={300}
              desc="Session progress: 10,800 seconds"
              icon={Clock}
              isCompleted={!!completed['stay_3_hours']}
              progress={`${Math.min(10800, metrics.stayTimeSeconds || 0)} / 10800s`}
              onAction={() => handleClaim('stay_3_hours', 300, 'Stay for 3 Hours')}
            />

            <TaskCard
              id="stay_5_hours"
              title="Stay for 5 Hours"
              reward={500}
              desc="Session progress: 18,000 seconds"
              icon={Clock}
              isCompleted={!!completed['stay_5_hours']}
              progress={`${Math.min(18000, metrics.stayTimeSeconds || 0)} / 18000s`}
              onAction={() => handleClaim('stay_5_hours', 500, 'Stay for 5 Hours')}
            />
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: PLAY TASKS */}
        {/* ========================================================================= */}
        {activeCategory === 'Play' && (
          <>
            <div className="text-[11px] font-bold text-[#9CA3AF] px-1">
              Level up, win street battles, upgrade your crib, and rank on the leaderboards:
            </div>

            {/* Level Up Group */}
            <TaskCard
              id="play_level_5"
              title="Reach Level 5 in Galaxy Shooter"
              reward={500}
              desc={`Current Shooter Level: ${gameState.shooterLevel || 1}`}
              icon={Zap}
              isCompleted={!!completed['play_level_5'] || (gameState.shooterLevel || 1) >= 5}
              onAction={() => handleClaim('play_level_5', 500, 'Reach Level 5')}
            />

            <TaskCard
              id="play_level_10"
              title="Reach Level 10 in Galaxy Shooter"
              reward={1000}
              desc={`Current Shooter Level: ${gameState.shooterLevel || 1}`}
              icon={Zap}
              isCompleted={!!completed['play_level_10'] || (gameState.shooterLevel || 1) >= 10}
              onAction={() => handleClaim('play_level_10', 1000, 'Reach Level 10')}
            />

            <TaskCard
              id="play_level_20"
              title="Reach Level 20 in Galaxy Shooter"
              reward={3000}
              desc={`Current Shooter Level: ${gameState.shooterLevel || 1}`}
              icon={Zap}
              isCompleted={!!completed['play_level_20'] || (gameState.shooterLevel || 1) >= 20}
              onAction={() => handleClaim('play_level_20', 3000, 'Reach Level 20')}
            />

            {/* Battles */}
            <TaskCard
              id="play_win_5_races"
              title="Win 5 Street Races"
              reward={300}
              desc="Dodge traffic and cross the distance line"
              icon={Trophy}
              isCompleted={!!completed['play_win_5_races']}
              onAction={() => handleClaim('play_win_5_races', 300, 'Win 5 Races')}
            />

            <TaskCard
              id="play_win_10_beef"
              title="Win 10 Beef 1v1 Battles"
              reward={500}
              desc="Defeat rivals in street showdowns"
              icon={Swords}
              isCompleted={!!completed['play_win_10_beef']}
              onAction={() => handleClaim('play_win_10_beef', 500, 'Win 10 Beef 1v1')}
            />

            <TaskCard
              id="play_win_3_turf_wars"
              title="Win 3 Turf Wars"
              reward={1000}
              desc="Conquer hood districts"
              icon={Flame}
              isCompleted={!!completed['play_win_3_turf_wars']}
              onAction={() => handleClaim('play_win_3_turf_wars', 1000, 'Win 3 Turf Wars')}
            />

            {/* Crib upgrades */}
            <TaskCard
              id="play_upgrade_ghetto"
              title="Upgrade Shack to Ghetto House"
              reward={300}
              desc="Expand your home base in Crib"
              icon={Sparkles}
              isCompleted={!!completed['play_upgrade_ghetto']}
              onAction={() => handleClaim('play_upgrade_ghetto', 300, 'Upgrade to Ghetto House')}
            />

            <TaskCard
              id="play_upgrade_duplex"
              title="Upgrade to Duplex"
              reward={800}
              desc="Double your safehouse stash"
              icon={Sparkles}
              isCompleted={!!completed['play_upgrade_duplex']}
              onAction={() => handleClaim('play_upgrade_duplex', 800, 'Upgrade to Duplex')}
            />

            <TaskCard
              id="play_upgrade_penthouse"
              title="Upgrade to Penthouse"
              reward={2000}
              desc="The highest tier crib in town"
              icon={Sparkles}
              isCompleted={!!completed['play_upgrade_penthouse']}
              onAction={() => handleClaim('play_upgrade_penthouse', 2000, 'Upgrade to Penthouse')}
            />

            {/* Leaderboard Top 10 */}
            <TaskCard
              id="play_leaderboard_top"
              title="Top 10 Daily Earners Bonus"
              reward={5000}
              desc="#1 gets 5,000 SC, #2-#10 get 1,000 SC daily"
              icon={Trophy}
              badge="5,000 SC"
              isCompleted={!!completed['play_leaderboard_top']}
              onAction={() => handleClaim('play_leaderboard_top', 5000, 'Top 10 Daily Earners')}
            />
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 8: EARN TASKS */}
        {/* ========================================================================= */}
        {activeCategory === 'Earn' && (
          <>
            <TaskCard
              id="earn_connect_tonkeeper"
              title="Connect Tonkeeper Wallet"
              reward={500}
              desc="Link your TON wallet for non-custodial payouts (One-time)"
              icon={Wallet}
              badge="500 SC"
              isCompleted={!!completed['earn_connect_tonkeeper'] || !!metrics.walletConnected}
              onAction={() => {
                updateTaskProgressMetrics({ walletConnected: 1 });
                handleClaim('earn_connect_tonkeeper', 500, 'Connect Tonkeeper Wallet');
              }}
            />

            <TaskCard
              id="earn_first_withdrawal"
              title="Make First Withdrawal"
              reward={500}
              desc="Withdraw your StreetCoins to TON, USDT, or NOT"
              icon={ShieldCheck}
              badge="500 SC"
              isCompleted={!!completed['earn_first_withdrawal']}
              onAction={() => handleClaim('earn_first_withdrawal', 500, 'First Withdrawal Bonus')}
            />

            <TaskCard
              id="earn_telegram_stars"
              title="Buy Telegram Stars / Boost"
              reward={10000}
              desc="Support game development with Telegram Stars monetization"
              icon={Star}
              badge="10,000 SC"
              buttonLabel="Buy Stars (10k SC)"
              isCompleted={!!completed['earn_telegram_stars']}
              onAction={() =>
                handleOpenAndVerify(
                  'earn_telegram_stars',
                  10000,
                  'Telegram Stars Boost',
                  OFFICIAL_LINKS.mainChannel
                )
              }
            />

            {/* Mystery Box */}
            <div
              id="task-item-mystery_box"
              className={`bg-[#121212] border border-[#FFD700]/40 rounded-2xl p-4 space-y-3 transition-all ${
                shakingTaskIds['mystery_box'] ? 'animate-subtle-shake ring-1 ring-[#FFD700]/60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FFD700]/15 border border-[#FFD700]/50 flex items-center justify-center text-[#FFD700] shadow-[0_0_12px_rgba(255,215,0,0.3)]">
                    <Gift className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Daily Mystery Box</h3>
                    <p className="text-[11px] text-[#9CA3AF]">
                      Open once every 24 hours for a surprise StreetCoin bundle
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#FFD700]/20 text-[#FFD700] text-xs font-black">
                  Random SC
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="text-xs font-bold text-[#9CA3AF]">
                  Status: {metrics.mysteryBoxOpenedToday ? (
                    <span className="text-emerald-400">Opened Today ✓</span>
                  ) : (
                    <span className="text-[#FFD700]">Ready to Open!</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleOpenMysteryBox}
                  disabled={Boolean(metrics.mysteryBoxOpenedToday)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                    metrics.mysteryBoxOpenedToday
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-[#FFD700] text-black hover:bg-yellow-400 active:scale-95 shadow-[0_0_12px_rgba(255,215,0,0.5)]'
                  }`}
                >
                  {metrics.mysteryBoxOpenedToday ? 'Opened Today' : 'Open Mystery Box'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 9: DAILY TASKS */}
        {/* ========================================================================= */}
        {activeCategory === 'Daily' && (
          <>
            <TaskCard
              id="daily_streak_checkin"
              title="Daily Streak Check-in"
              reward={100}
              desc="Day 1: 100 SC, Day 2: 200 SC, Day 3: 300 SC, Day 7: 2,000 SC"
              icon={Calendar}
              buttonLabel="Check-in Daily"
              isCompleted={gameState.hasPlayedToday}
              onAction={() => handleClaim('daily_streak_checkin', 100, 'Daily Streak Check-in')}
            />

            {/* Daily Quiz */}
            <div
              id="task-item-daily_quiz"
              className={`bg-[#121212] border border-white/10 rounded-2xl p-4 space-y-3 transition-all ${
                shakingTaskIds['daily_quiz'] ? 'animate-subtle-shake ring-1 ring-blue-500/60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Daily Street Quiz</h3>
                    <p className="text-[11px] text-[#9CA3AF]">
                      Test your street knowledge for +100 SC per correct answer
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs font-black">
                  100 SC / Q
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="text-xs font-bold text-[#9CA3AF]">
                  Today answered: <span className="text-white">{metrics.dailyQuizAnswersToday || 0}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setShowQuizModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#FFD700] text-black font-black text-xs uppercase active:scale-95 shadow-[0_0_10px_rgba(255,215,0,0.4)]"
                >
                  Start Quiz
                </button>
              </div>
            </div>

            <TaskCard
              id="daily_spin_task"
              title="Daily Wheel of Fortune"
              reward={150}
              desc="Spin the street wheel daily to win tokens & boost multipliers"
              icon={Sparkles}
              isCompleted={!!completed['daily_spin_task']}
              buttonLabel="Spin Now"
              onAction={() => handleClaim('daily_spin_task', 150, 'Daily Wheel of Fortune')}
            />
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 10: OTHER TASKS */}
        {/* ========================================================================= */}
        {activeCategory === 'Other' && (
          <>
            <div className="text-[11px] font-bold text-[#9CA3AF] px-1">
              Backup bounties, seasonal community events & early adopter rewards:
            </div>

            <TaskCard
              id="other_turn_on_notifications"
              title="Turn on Push Notifications"
              reward={150}
              desc="Never miss high-yield bank heist windows"
              icon={Zap}
              isCompleted={!!completed['other_turn_on_notifications']}
              onAction={() =>
                handleClaim('other_turn_on_notifications', 150, 'Turn on Notifications')
              }
            />

            <TaskCard
              id="other_pin_telegram_channel"
              title="Pin Street Life in Telegram"
              reward={200}
              desc="Pin our channel at the top of your chats"
              link={OFFICIAL_LINKS.mainChannel}
              icon={Send}
              isCompleted={!!completed['other_pin_telegram_channel']}
              onAction={() =>
                handleClaim('other_pin_telegram_channel', 200, 'Pin Telegram Channel')
              }
            />

            <TaskCard
              id="other_community_feedback"
              title="Submit Alpha Feedback"
              reward={250}
              desc="Give feedback on gameplay mechanics"
              icon={MessageSquare}
              isCompleted={!!completed['other_community_feedback']}
              onAction={() =>
                handleClaim('other_community_feedback', 250, 'Alpha Feedback')
              }
            />
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* STATUS POST PROOF MODAL */}
      {/* ========================================================================= */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#FFD700]/40 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-[0_0_30px_rgba(0,0,0,0.9)] animate-scaleUp">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-[#FFD700]" />
                <h3 className="text-base font-black text-white uppercase">Upload Status Proof</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="text-[#9CA3AF] hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-[#9CA3AF]">
              <p>1. Copy our game link: <code className="text-[#FFD700]">{OFFICIAL_LINKS.gameLink}</code></p>
              <p>2. Post it on your <strong>WhatsApp or Telegram Status</strong>.</p>
              <p>3. Take a screenshot showing timestamp and views, then confirm upload below.</p>
            </div>

            <div className="border-2 border-dashed border-[#FFD700]/30 rounded-xl p-4 text-center bg-[#181818] space-y-2">
              <Upload className="w-8 h-8 text-[#FFD700] mx-auto animate-bounce" />
              <div className="text-xs font-bold text-white">Status Screenshot Selected</div>
              <div className="text-[10px] text-emerald-400 font-mono">proof_status_verified.jpg (1.2 MB)</div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-white font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusSubmit}
                className="flex-1 py-2.5 rounded-xl bg-[#FFD700] text-black font-black text-xs uppercase shadow-[0_0_12px_rgba(255,215,0,0.4)]"
              >
                Verify & Claim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIDEO PROMO MODAL */}
      {/* ========================================================================= */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-purple-500/40 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-[0_0_30px_rgba(0,0,0,0.9)] animate-scaleUp">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-black text-white uppercase">Submit Video Link</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowVideoModal(false)}
                className="text-[#9CA3AF] hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-[#9CA3AF]">
              <p>• Platform: <strong>TikTok, Facebook, or YouTube</strong> (Instagram NOT allowed).</p>
              <p>• Criteria: Minimum <strong>1,000 views + 100 likes</strong>.</p>
              <p>• Reward: Fixed at <strong>200 SC</strong> per verified submission.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white uppercase">Your Video URL</label>
              <input
                type="text"
                placeholder="https://www.tiktok.com/@user/video/..."
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                className="w-full bg-[#181818] border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFD700]"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowVideoModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-white font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVideoSubmit}
                className="flex-1 py-2.5 rounded-xl bg-[#FFD700] text-black font-black text-xs uppercase shadow-[0_0_12px_rgba(255,215,0,0.4)]"
              >
                Submit Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUIZ MODAL */}
      {/* ========================================================================= */}
      {showQuizModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#FFD700]/40 rounded-2xl w-full max-w-sm p-5 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#FFD700]" />
                <h3 className="text-base font-black text-white uppercase">
                  Street Quiz #{quizQuestionIndex + 1}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuizModal(false)}
                className="text-[#9CA3AF] hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-sm font-bold text-white leading-relaxed">
              {QUIZ_QUESTIONS[quizQuestionIndex].q}
            </div>

            <div className="space-y-2">
              {QUIZ_QUESTIONS[quizQuestionIndex].options.map((opt, idx) => {
                const isSelected = quizSelectedOption === idx;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setQuizSelectedOption(idx);
                    }}
                    className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-[#FFD700] text-black font-black shadow-[0_0_8px_rgba(255,215,0,0.4)]'
                        : 'bg-[#181818] text-[#9CA3AF] hover:text-white border border-white/10'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAnswerQuiz}
              disabled={quizSelectedOption === null}
              className={`w-full py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
                quizSelectedOption === null
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-[#FFD700] text-black shadow-[0_0_12px_rgba(255,215,0,0.5)]'
              }`}
            >
              Submit Answer (+100 SC)
            </button>
          </div>
        </div>
      )}
      </div>
    </ShakingTasksContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Reusable Task Card Component
// ---------------------------------------------------------------------------
interface TaskCardProps {
  id: string;
  title: string;
  reward: number;
  desc: string;
  icon: React.ElementType;
  link?: string;
  badge?: string;
  buttonLabel?: string;
  isCompleted?: boolean;
  isVerifying?: boolean;
  isShaking?: boolean;
  progress?: string;
  onAction: (e?: React.MouseEvent<HTMLButtonElement>) => void;
}

function TaskCard({
  id,
  title,
  reward,
  desc,
  icon: Icon,
  badge,
  buttonLabel,
  isCompleted,
  isVerifying,
  isShaking: propIsShaking,
  progress,
  onAction,
}: TaskCardProps) {
  const shakingMap = React.useContext(ShakingTasksContext);
  const isShaking = propIsShaking ?? Boolean(shakingMap[id]);

  return (
    <div
      id={`task-item-${id}`}
      className={`bg-[#121212] border border-white/10 rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all hover:border-[#FFD700]/30 ${
        isShaking ? 'animate-subtle-shake ring-1 ring-[#FFD700]/60' : ''
      }`}
    >
      {/* Icon and text */}
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        <div
          className={`w-10 h-10 rounded-xl bg-[#1A1A1A] border flex items-center justify-center flex-shrink-0 transition-colors ${
            isShaking
              ? 'border-[#FFD700] text-[#FFD700] bg-[#FFD700]/10 shadow-[0_0_10px_rgba(255,215,0,0.3)]'
              : 'border-white/10 text-[#FFD700]'
          }`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-xs font-black text-white truncate">{title}</h4>
            <span className="text-[10px] font-black text-[#FFD700] bg-[#FFD700]/10 px-1.5 py-0.2 rounded border border-[#FFD700]/30 whitespace-nowrap">
              +{reward.toLocaleString()} SC
            </span>
            {badge && (
              <span className="text-[9px] font-bold text-purple-300 bg-purple-500/20 px-1.5 rounded whitespace-nowrap">
                {badge}
              </span>
            )}
          </div>
          <p className="text-[10px] text-[#9CA3AF] truncate mt-0.5">{desc}</p>
          {progress && (
            <div className="text-[10px] text-amber-400 font-bold mt-0.5">
              Progress: {progress}
            </div>
          )}
        </div>
      </div>

      {/* Action / Verified button */}
      <div className="flex-shrink-0">
        {isCompleted ? (
          <div className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Done</span>
          </div>
        ) : isVerifying ? (
          <div className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-[#FFD700]/20 text-[#FFD700] text-xs font-black animate-pulse">
            <span>Checking...</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAction}
            className="px-3.5 py-2 rounded-xl bg-[#FFD700] hover:bg-yellow-400 text-black font-black text-xs uppercase tracking-tight shadow-[0_0_10px_rgba(255,215,0,0.3)] active:scale-95 transition-all cursor-pointer"
          >
            {buttonLabel || 'Start / Join'}
          </button>
        )}
      </div>
    </div>
  );
}
