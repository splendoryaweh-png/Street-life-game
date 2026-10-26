'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Gift,
  Zap,
  Coins,
  Crosshair,
  Sparkles,
  Shield,
  Bell,
  CheckCircle2,
  Lock,
  Tv,
  Clock,
  Database,
  ChevronRight,
  Gamepad2,
  Trophy,
  X,
  Info,
} from 'lucide-react';
import {
  getTodayDailyClaim,
  updateTodayDailyClaim,
  getTimeUntilReset,
  DAILY_LOGIN_SCHEDULE,
  getDailyClaimsTable,
  DailyClaimsDbRecord,
  claimRacingAdNitro,
  buyRacingNitroWithCoins,
  claimShooterAdPowerup,
} from '@/lib/dailyFree';
import { getGameStateSnapshot, addGameCoins } from '@/lib/storage';
import {
  playCoinSound,
  playSuccessSound,
  playClickSound,
  playPickupSound,
} from '@/lib/sound';
import confetti from 'canvas-confetti';
import { TasksEarnCoinsModal } from '@/components/TasksEarnCoinsModal';

interface FloatingToken {
  id: string;
  label: string;
  icon: string;
  x: number;
}

interface StreakDayItem {
  day: number;
  sc: number;
  perk: string;
  badge: string;
  icon: string;
  category: string;
  description: string;
  unlockEffect: string;
}

const DETAILED_STREAK_SCHEDULE: StreakDayItem[] = [
  {
    day: 1,
    sc: 100,
    perk: '+1 Free Nitro',
    badge: 'FREE NITRO',
    icon: '⚡',
    category: 'STREET RACING & OKADA',
    description: '1 Free Nitro Boost Bottle instantly loaded into your racing dashboard.',
    unlockEffect: 'Gives +60% turbo acceleration burst on the highway.',
  },
  {
    day: 2,
    sc: 200,
    perk: '+2 Free Coin Packs',
    badge: '50 BONUS COINS',
    icon: '🪙',
    category: 'INVENTORY & SHOP',
    description: '2 Packs containing 50 in-game currency coins for buying drip drip & crib gear.',
    unlockEffect: 'Added directly to your game wallet for drip outfits.',
  },
  {
    day: 3,
    sc: 300,
    perk: '+1 Free Shooter Power-up',
    badge: 'DOUBLE BULLET',
    icon: '🎯',
    category: 'GALAXY SHOOTER',
    description: 'Instant Double Bullet stream or 100% Supercharged Energy upon launching shooter.',
    unlockEffect: 'Active for 30 seconds of high-powered enemy shredding.',
  },
  {
    day: 4,
    sc: 400,
    perk: '+3 Free Nitro',
    badge: 'TRIPLE NITRO',
    icon: '⚡',
    category: 'STREET RACING',
    description: '3 High-compression nitrous canisters ready for high-speed PvP duels.',
    unlockEffect: 'Refuels your nitro boost gauge 3 times without spending SC.',
  },
  {
    day: 5,
    sc: 500,
    perk: '+5 Slot Free Spins',
    badge: '5 FREE SPINS',
    icon: '🎰',
    category: 'STREET CASINO',
    description: '5 Free Spins on the 3-reel Street Slot without paying the 20 SC entry fee.',
    unlockEffect: 'Chance to hit the 1,000 SC House Jackpot for free!',
  },
  {
    day: 6,
    sc: 600,
    perk: '+1 Shield Power-up',
    badge: 'DAMAGE SHIELD',
    icon: '🛡️',
    category: 'TURF WAR & COMBAT',
    description: 'Full armor deflection shield providing 100% damage invulnerability.',
    unlockEffect: 'Survive enemy thug shootouts and dominate capture zones.',
  },
  {
    day: 7,
    sc: 1000,
    perk: 'Jackpot Box (500-2000 SC)',
    badge: 'MYSTERY VAULT',
    icon: '👑',
    category: 'LEGENDARY STREAK',
    description: 'Grand 7-Day Completion Vault! 1,000 SC guaranteed + random 500 to 2,000 SC bonus.',
    unlockEffect: 'Streak resets back to Day 1 with your total earnings safe.',
  },
];

export default function DailyFreePage() {
  const [claimRecord, setClaimRecord] = useState<DailyClaimsDbRecord | null>(null);
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; formatted: string }>({
    hours: 12,
    minutes: 0,
    seconds: 0,
    formatted: '12h 00m 00s',
  });
  const [currentCoins, setCurrentCoins] = useState<number>(0);
  const [streak, setStreak] = useState<number>(1);

  const [floatingTokens, setFloatingTokens] = useState<FloatingToken[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [dbExpanded, setDbExpanded] = useState(false);
  const [adWatchingType, setAdWatchingType] = useState<string | null>(null);

  // 7-Day Modal & Preview State
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [selectedStreakDay, setSelectedStreakDay] = useState<number>(1);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [showTasksModal, setShowTasksModal] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  // Sync state after user actions
  const refreshState = useCallback(() => {
    const userState = getGameStateSnapshot();
    setCurrentCoins(userState.streetCoin);
    setStreak(userState.dailyStreak || 1);

    const record = getTodayDailyClaim(userState.dailyStreak || 1);
    setClaimRecord(record);
  }, []);

  // Timer countdown loop & client hydration sync
  useEffect(() => {
    refreshState();
    setTimeLeft(getTimeUntilReset());
    const timerInterval = setInterval(() => {
      setTimeLeft(getTimeUntilReset());
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [refreshState]);

  // Trigger floating token animation
  const triggerFloatingTokens = (items: { label: string; icon: string }[]) => {
    const newTokens = items.map((item, idx) => ({
      id: `token_${Date.now()}_${idx}`,
      label: item.label,
      icon: item.icon,
      x: 30 + idx * 15,
    }));
    setFloatingTokens((prev) => [...prev, ...newTokens]);
    setTimeout(() => {
      setFloatingTokens((prev) => prev.filter((t) => !newTokens.some((nt) => nt.id === t.id)));
    }, 2500);
  };

  // Open Streak Modal with specific day preselected
  const handleOpenStreakModal = (dayNum?: number) => {
    playClickSound();
    setSelectedStreakDay(dayNum || streak);
    setShowStreakModal(true);
  };

  // Claim All Free Rewards
  const handleClaimAll = () => {
    if (!claimRecord) return;
    if (claimRecord.claimed_all_today && claimRecord.login_claimed) {
      showToast('⚠️ You have already claimed all today’s login rewards!');
      playClickSound();
      return;
    }

    playSuccessSound();
    try {
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.4 },
        colors: ['#FFD700', '#F59E0B', '#38BDF8', '#10B981', '#FFFFFF'],
      });
    } catch {}

    const schedule = DAILY_LOGIN_SCHEDULE[(streak - 1) % 7] || DAILY_LOGIN_SCHEDULE[0];
    let scReward = schedule.sc;

    // Day 7 random jackpot box (500-2000 SC)
    if (streak % 7 === 0) {
      const jackpotBonus = 500 + Math.floor(Math.random() * 1500);
      scReward = 1000 + jackpotBonus;
    }

    addGameCoins(scReward, `+${scReward} SC - Daily Free Rewards All-In-One!`, 'daily_reward');

    const updated = updateTodayDailyClaim(() => ({
      login_claimed: true,
      login_reward_sc: scReward,
      login_perk: schedule.perk,
      claimed_all_today: true,
    }));
    setClaimRecord(updated);

    // Floating animation
    triggerFloatingTokens([
      { label: `+${scReward} SC`, icon: '🪙' },
      { label: `+3 NITRO`, icon: '⚡' },
      { label: `+3 SPINS`, icon: '🎰' },
      { label: schedule.perk, icon: '🎁' },
    ]);

    showToast(`🎉 Claimed All Free Daily Rewards! +${scReward} SC & Perks!`);
    refreshState();
  };

  // Watch Ad for Racing Nitro
  const handleWatchAdForNitro = () => {
    if (!claimRecord) return;
    if (claimRecord.nitro_ad_claims_count >= 5) {
      showToast('Maximum 5 nitro ad bonuses reached today!');
      return;
    }

    setAdWatchingType('nitro');
    playClickSound();
    setTimeout(() => {
      const res = claimRacingAdNitro();
      setAdWatchingType(null);
      if (res.success) {
        playPickupSound();
        triggerFloatingTokens([{ label: '+1 NITRO', icon: '⚡' }]);
        showToast(`⚡ +1 Nitro granted! (${res.remaining} available)`);
        refreshState();
      }
    }, 1500);
  };

  // Buy Nitro with Coins
  const handleBuyNitro = () => {
    if (currentCoins < 50) {
      showToast('Need at least 50 SC to buy a nitro bottle!');
      playClickSound();
      return;
    }

    addGameCoins(-50, '-50 SC - Purchased Nitro Bottle', 'task_reward');
    buyRacingNitroWithCoins();
    playPickupSound();
    triggerFloatingTokens([{ label: '+1 NITRO', icon: '⚡' }]);
    showToast('⚡ Purchased 1 Nitro for 50 SC!');
    refreshState();
  };

  // Watch Ad for Shooter Powerup
  const handleWatchAdForShooter = () => {
    if (!claimRecord) return;
    if (claimRecord.shooter_ad_powerups_count >= 3) {
      showToast('Maximum 3 shooter power-up ads reached today!');
      return;
    }

    setAdWatchingType('shooter');
    playClickSound();
    setTimeout(() => {
      const res = claimShooterAdPowerup();
      setAdWatchingType(null);
      if (res.success) {
        playPickupSound();
        const pLabel = res.powerup === 'double_bullet' ? 'Double Bullet' : 'Energy Pack';
        triggerFloatingTokens([{ label: `+1 ${pLabel}`, icon: '🎯' }]);
        showToast(`🎯 +1 Free Power-up (${pLabel}) Activated!`);
        refreshState();
      }
    }, 1500);
  };

  // Simulate Push Notification
  const handleTriggerTestPush = () => {
    playSuccessSound();
    setShowNotificationBanner(true);
    setTimeout(() => {
      setShowNotificationBanner(false);
    }, 5000);
  };

  const scheduleIndex = (streak - 1) % 7;
  const currentSchedule = DAILY_LOGIN_SCHEDULE[scheduleIndex] || DAILY_LOGIN_SCHEDULE[0];
  const allDbRecords = getDailyClaimsTable();

  return (
    <div className="min-h-screen w-full bg-[#07080B] text-white flex flex-col items-center pb-32 select-none overflow-y-auto">
      {/* TOAST MESSAGE */}
      {toastMsg && (
        <div className="fixed top-5 z-50 bg-[#FFD700] text-black px-4 py-2.5 rounded-full font-black text-xs shadow-[0_0_20px_#FFD700] animate-in fade-in slide-in-from-top-4 duration-200">
          {toastMsg}
        </div>
      )}

      {/* FLOATING TOKENS ANIMATION */}
      {floatingTokens.map((t) => (
        <div
          key={t.id}
          className="fixed z-50 pointer-events-none text-base font-black text-[#FFD700] flex items-center gap-1 drop-shadow-[0_0_12px_#FFD700] animate-bounce"
          style={{
            top: '35%',
            left: `${t.x}%`,
            transition: 'all 2s ease-out',
          }}
        >
          <span>{t.icon}</span>
          <span>{t.label}</span>
        </div>
      ))}

      {/* SIMULATED PUSH NOTIFICATION BANNER */}
      {showNotificationBanner && (
        <div className="fixed top-3 left-4 right-4 max-w-md mx-auto z-50 bg-black/95 border-2 border-[#FFD700] rounded-2xl p-4 shadow-[0_0_30px_rgba(255,215,0,0.5)] flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
          <div className="w-10 h-10 rounded-xl bg-[#FFD700] flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6 text-black fill-black" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#FFD700] uppercase tracking-wider">
                Street Life Daily Push
              </span>
              <span className="text-[9px] text-gray-400">Just now</span>
            </div>
            <p className="text-xs font-black text-white mt-0.5">
              🚀 Your 3 Free Nitros are ready! Come race!
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Also 5 Double Coins active on the solo asphalt today.
            </p>
          </div>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="w-full max-w-md sticky top-0 z-40 bg-[#07080B]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          onClick={() => playClickSound()}
          className="p-2 -ml-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="flex flex-col items-center">
          <span className="text-xs font-black italic tracking-widest text-[#FFD700] uppercase">
            DAILY FREE SYSTEM
          </span>
          <span className="text-[10px] text-gray-400">Retention & Free Fuel</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-[#FFD700]/30 text-xs font-black text-[#FFD700]">
          <Coins className="w-3.5 h-3.5" />
          <span>{currentCoins.toLocaleString()} SC</span>
        </div>
      </div>

      {/* =========================================================================
          NEW SECTION AT VERY TOP: TASKS - Earn Coins with "View All Tasks"
         ========================================================================= */}
      <div className="w-full max-w-md px-4 pt-4">
        <div className="relative rounded-3xl bg-gradient-to-r from-[#1c180e] via-[#121212] to-[#1a160d] border-2 border-[#FFD700] p-4 shadow-[0_0_25px_rgba(255,215,0,0.25)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FFD700] flex items-center justify-center text-black shadow-md shadow-[#FFD700]/30 shrink-0">
              <Coins className="w-6 h-6 fill-black" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-black uppercase text-white tracking-wider">
                  TASKS - Earn Coins
                </h2>
                <span className="px-1.5 py-0.5 rounded bg-[#FFD700] text-black text-[9px] font-black uppercase">
                  10 TASKS
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Complete social steps, watch ads &amp; post content for huge SC!
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              playClickSound();
              setShowTasksModal(true);
            }}
            type="button"
            className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-[#FFD700] via-yellow-400 to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer hover:brightness-110 shrink-0"
          >
            View All Tasks
          </button>
        </div>
      </div>

      {/* HERO RESET TIMER BANNER */}
      <div className="w-full max-w-md px-4 pt-4">
        <div className="relative rounded-3xl bg-gradient-to-r from-yellow-500/15 via-amber-500/10 to-yellow-600/20 border-2 border-[#FFD700]/50 p-5 overflow-hidden shadow-[0_0_25px_rgba(255,215,0,0.15)]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#FFD700] flex items-center justify-center">
                <Clock className="w-4 h-4 text-black" />
              </div>
              <span className="text-xs font-black tracking-wider uppercase text-[#FFD700]">
                Daily Refresh Timer
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-gray-300 px-2 py-0.5 rounded-full bg-black/50 border border-white/10">
              24H CYCLE
            </span>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <div>
              <p className="text-2xl font-black font-mono tracking-tight text-white">
                {timeLeft.formatted}
              </p>
              <p className="text-[10px] text-gray-400">Until all daily counters & free perks refill</p>
            </div>

            <button
              onClick={handleTriggerTestPush}
              type="button"
              className="px-3 py-1.5 rounded-xl bg-black/50 border border-white/20 text-[10px] font-bold text-gray-300 hover:text-white flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Bell className="w-3.5 h-3.5 text-[#FFD700]" />
              Test Push
            </button>
          </div>

          {/* Big CLAIM ALL Button */}
          <div className="mt-4">
            <button
              onClick={handleClaimAll}
              disabled={claimRecord?.claimed_all_today && claimRecord?.login_claimed}
              type="button"
              className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                claimRecord?.claimed_all_today && claimRecord?.login_claimed
                  ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 cursor-default'
                  : 'bg-gradient-to-r from-[#FFD700] via-yellow-400 to-[#FFA500] text-black shadow-[0_0_25px_rgba(255,215,0,0.6)] active:scale-95'
              }`}
            >
              {claimRecord?.claimed_all_today && claimRecord?.login_claimed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  All Daily Perks Claimed For Today
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4 fill-black" />
                  Claim All Free Rewards ({currentSchedule.sc} SC + Perks)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 1. 7-DAY LOGIN REWARD STREAK (CLICK TO OPEN DETAILED MODAL) */}
      <div className="w-full max-w-md px-4 mt-5">
        <div
          onClick={() => handleOpenStreakModal()}
          className="cursor-pointer group rounded-3xl bg-gradient-to-b from-[#181820] to-[#101015] border border-white/10 hover:border-[#FFD700]/60 p-4 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(255,215,0,0.15)]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#FFD700]" />
              <h2 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                <span>1. 7-Day Login Streak Box</span>
                <Info className="w-3.5 h-3.5 text-[#FFD700] opacity-80 group-hover:opacity-100 transition-opacity" />
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/30 px-2 py-0.5 rounded-full">
                Day {streak} of 7
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#FFD700] transition-colors" />
            </div>
          </div>

          {/* Quick interactive strip */}
          <div className="grid grid-cols-7 gap-1.5 mt-3">
            {DETAILED_STREAK_SCHEDULE.map((item) => {
              const isCompleted = item.day < streak;
              const isCurrent = item.day === streak;

              return (
                <div
                  key={item.day}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenStreakModal(item.day);
                  }}
                  onMouseEnter={() => setHoveredDay(item.day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  className={`relative flex flex-col items-center justify-between p-2 rounded-2xl border transition-all text-center cursor-pointer ${
                    isCurrent
                      ? 'bg-gradient-to-b from-[#2A2311] to-[#120F08] border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.3)] ring-1 ring-[#FFD700] scale-105'
                      : isCompleted
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300 opacity-80 hover:opacity-100'
                      : 'bg-black/40 border-white/5 opacity-60 hover:opacity-100 hover:border-white/20'
                  }`}
                >
                  <span className="text-[9px] font-bold text-gray-400">D{item.day}</span>

                  <div className="my-1 text-base">
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                    ) : isCurrent ? (
                      <span className="animate-pulse">{item.icon}</span>
                    ) : (
                      <span className="grayscale opacity-75">{item.icon}</span>
                    )}
                  </div>

                  <span className="text-[9px] font-black text-[#FFD700]">+{item.sc}</span>
                </div>
              );
            })}
          </div>

          {/* Quick Hover / Active Day Preview Strip */}
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-gray-400">
                {hoveredDay ? `Day ${hoveredDay} Bonus:` : `Today (Day ${streak}):`}
              </span>
              <span className="font-black text-[#FFD700] truncate">
                {DETAILED_STREAK_SCHEDULE[(hoveredDay || streak) - 1]?.perk || '+1 Free Nitro'}
              </span>
            </div>
            <span className="text-[9px] font-bold text-cyan-400 shrink-0 flex items-center gap-0.5">
              Tap to view roadmap &gt;
            </span>
          </div>
        </div>
      </div>

      {/* 2. RACING FREE NITRO CARD */}
      <div className="w-full max-w-md px-4 mt-4">
        <div className="rounded-3xl bg-black/60 border border-white/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
                <Zap className="w-5 h-5 fill-cyan-400" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase text-white">
                  2. Daily Free Nitro For Racing
                </h3>
                <p className="text-[10px] text-gray-400">3 Free Bottles granted every 24 hours</p>
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-xs font-mono font-black text-cyan-300">
              {claimRecord?.free_nitro_remaining ?? 3}/3 Free
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={handleWatchAdForNitro}
              disabled={adWatchingType === 'nitro' || (claimRecord?.nitro_ad_claims_count ?? 0) >= 5}
              type="button"
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600/30 to-blue-600/30 border border-cyan-500/40 text-[10px] font-black text-cyan-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <Tv className="w-3.5 h-3.5" />
              {adWatchingType === 'nitro'
                ? 'Watching Ad...'
                : `+1 Nitro Ad (${claimRecord?.nitro_ad_claims_count ?? 0}/5)`}
            </button>

            <button
              onClick={handleBuyNitro}
              type="button"
              className="py-2.5 px-3 rounded-xl bg-black/50 border border-white/15 text-[10px] font-black text-gray-200 hover:text-white flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <Coins className="w-3.5 h-3.5 text-[#FFD700]" />
              Buy Nitro (50 SC)
            </button>
          </div>
        </div>
      </div>

      {/* 3. RACING 2X BONUS COINS ON ROAD */}
      <div className="w-full max-w-md px-4 mt-3">
        <div className="rounded-3xl bg-black/60 border border-white/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase text-white">
                3. First 5 Daily Road Coins (2X)
              </h3>
              <p className="text-[10px] text-gray-400">
                Solo asphalt coins give 20-30 SC with golden aura
              </p>
            </div>
          </div>
          <div className="px-2.5 py-1 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs font-mono font-black text-amber-300">
            {claimRecord?.coin_bonus_claimed_count ?? 0}/5 Claimed
          </div>
        </div>
      </div>

      {/* 4. SHOOTER DAILY POWER-UP */}
      <div className="w-full max-w-md px-4 mt-3">
        <div className="rounded-3xl bg-black/60 border border-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-400">
                <Crosshair className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase text-white">
                  4. Daily Free Shooter Power-up
                </h3>
                <p className="text-[10px] text-gray-400">
                  Double Bullet or Energy Pack activated on launch
                </p>
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-purple-950/60 border border-purple-500/40 text-xs font-mono font-black text-purple-300">
              {claimRecord?.shooter_powerup_daily_granted ? 'Active' : 'Ready'}
            </div>
          </div>

          <button
            onClick={handleWatchAdForShooter}
            disabled={adWatchingType === 'shooter' || (claimRecord?.shooter_ad_powerups_count ?? 0) >= 3}
            type="button"
            className="w-full mt-2 py-2.5 px-3 rounded-xl bg-purple-900/30 border border-purple-500/40 text-[10px] font-black text-purple-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Tv className="w-3.5 h-3.5" />
            {adWatchingType === 'shooter'
              ? 'Loading Ad...'
              : `Watch Ad for +1 Random Power-up (${claimRecord?.shooter_ad_powerups_count ?? 0}/3)`}
          </button>
        </div>
      </div>

      {/* 5. MINI-GAMES FREE PERKS (SLOT, DICE, CRUSH, FLIP) */}
      <div className="w-full max-w-md px-4 mt-3">
        <div className="rounded-3xl bg-black/60 border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[#FFD700]" />
            <h3 className="text-xs font-black uppercase text-white">
              5. Daily Free Mini-Game Entries
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-300">🎰 Street Slot</span>
              <span className="text-xs font-black text-[#FFD700] mt-1">
                {claimRecord?.slot_free_spins_remaining ?? 3} Free Spins
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-300">🎲 Street Dice</span>
              <span className="text-xs font-black text-emerald-400 mt-1">
                {claimRecord?.dice_free_entries_remaining ?? 1} Free Entry
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-300">🍬 Street Crush</span>
              <span className="text-xs font-black text-pink-400 mt-1">
                +{claimRecord?.crush_free_moves_remaining ? 5 : 0} Extra Moves
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-300">🃏 Street Flip</span>
              <span className="text-xs font-black text-cyan-400 mt-1">
                +{claimRecord?.flip_free_time_remaining ? 15 : 0}s Extra Time
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. DATABASE TRANSPARENCY & ANTI-ABUSE INSPECTOR */}
      <div className="w-full max-w-md px-4 mt-4">
        <div className="rounded-3xl bg-black/80 border border-white/10 p-4">
          <button
            onClick={() => setDbExpanded(!dbExpanded)}
            type="button"
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#FFD700]" />
              <span className="text-xs font-black text-gray-200">
                DB Storage & Anti-Abuse (`daily_claims`)
              </span>
            </div>
            <span className="text-[10px] text-gray-400">
              {dbExpanded ? 'Hide' : 'Inspect'}
            </span>
          </button>

          {dbExpanded && claimRecord && (
            <div className="mt-3 pt-3 border-t border-white/10 text-[10px] font-mono text-gray-300 flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Device ID:</span>
                <span className="text-yellow-400">{claimRecord.device_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Simulated IP:</span>
                <span>{claimRecord.ip_address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date Partition:</span>
                <span>{claimRecord.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Anti-Abuse Rule:</span>
                <span className="text-emerald-400">1 claim per 24h per device enforced</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Historical Days:</span>
                <span>{allDbRecords.length} records</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* QUICK LAUNCH ACTIONS */}
      <div className="w-full max-w-md px-4 mt-5 flex gap-2">
        <Link
          href="/"
          className="flex-1 py-3.5 rounded-2xl bg-[#FFD700] text-black font-black text-xs uppercase tracking-wider text-center flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_0_15px_rgba(255,215,0,0.4)]"
        >
          <Gamepad2 className="w-4 h-4" />
          Play Games Now
        </Link>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* DETAILED 7-DAY LOGIN STREAK ROADMAP & PERKS MODAL */}
      {/* ------------------------------------------------------------- */}
      {showStreakModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#181822] via-[#101016] to-[#0A0A0E] border-2 border-[#FFD700]/70 p-5 shadow-[0_0_35px_rgba(255,215,0,0.3)] flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700]/50 flex items-center justify-center text-[#FFD700]">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase text-white tracking-wide">
                    7-Day Streak Roadmap
                  </h3>
                  <p className="text-[10px] text-gray-400">All 7 Days Rewards & Exclusive Perks</p>
                </div>
              </div>

              <button
                onClick={() => {
                  playClickSound();
                  setShowStreakModal(false);
                }}
                type="button"
                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white active:scale-90 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Streak Indicator Ribbon */}
            <div className="my-3 py-2 px-3 rounded-2xl bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-between text-xs shrink-0">
              <span className="text-[10px] font-bold text-gray-300">Your Current Status:</span>
              <span className="font-black text-[#FFD700] uppercase">
                Day {streak} of 7 {streak >= 7 ? '(Grand Vault Ready!)' : ''}
              </span>
            </div>

            {/* Scrollable 7 Days List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 no-scrollbar my-1">
              {DETAILED_STREAK_SCHEDULE.map((item) => {
                const isPast = item.day < streak;
                const isCurrent = item.day === streak;
                const isLocked = item.day > streak;
                const isSelected = selectedStreakDay === item.day;

                return (
                  <div
                    key={item.day}
                    onClick={() => {
                      playClickSound();
                      setSelectedStreakDay(item.day);
                    }}
                    className={`rounded-2xl p-3 border transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-gradient-to-r from-yellow-500/20 via-amber-500/10 to-yellow-600/20 border-[#FFD700] ring-1 ring-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.2)]'
                        : isPast
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : isSelected
                        ? 'bg-white/10 border-white/30'
                        : 'bg-black/40 border-white/10 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{item.icon}</span>
                        <div>
                          <span className="text-xs font-black uppercase text-white">
                            Day {item.day}
                          </span>
                          <span className="text-[9px] font-mono text-gray-400 ml-1.5 uppercase">
                            • {item.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-[#FFD700]">+{item.sc} SC</span>
                        {isPast ? (
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40">
                            Claimed
                          </span>
                        ) : isCurrent ? (
                          <span className="text-[9px] font-black text-black bg-[#FFD700] px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                            Today
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] font-bold text-[#FFD700] mt-1">
                      🎁 Perk: {item.perk}
                    </p>
                    <p className="text-[10px] text-gray-300 mt-0.5 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between text-[9px] text-gray-400">
                      <span>Effect:</span>
                      <span className="font-semibold text-cyan-300 truncate max-w-[200px]">
                        {item.unlockEffect}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Bottom CTA */}
            <div className="pt-3 border-t border-white/10 flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setShowStreakModal(false);
                  if (!claimRecord?.login_claimed) {
                    handleClaimAll();
                  }
                }}
                type="button"
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#FFD700] to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(255,215,0,0.4)] active:scale-95 transition-all cursor-pointer"
              >
                <Gift className="w-4 h-4 fill-black" />
                {claimRecord?.login_claimed ? 'Close Roadmap' : 'Claim Today’s Rewards'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL TASKS MODAL (10 Tasks across 4 sections) */}
      <TasksEarnCoinsModal
        isOpen={showTasksModal}
        onClose={() => setShowTasksModal(false)}
        onToast={showToast}
        currentCoins={currentCoins}
      />
    </div>
  );
}
