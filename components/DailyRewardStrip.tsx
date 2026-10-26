'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  CheckCircle2,
  Lock,
  Gift,
  Play,
  Zap,
  Shield,
  Crosshair,
  Coins,
  Sparkles,
  Tv,
  HelpCircle,
} from 'lucide-react';
import { playCoinSound, playClickSound, playSuccessSound } from '@/lib/sound';
import confetti from 'canvas-confetti';

interface DailyRewardStripProps {
  hasPlayedToday: boolean;
  dailyStreak: number;
  lastClaimDate: string | null;
  onClaim: (amount: number, bonusItem?: string) => void;
  onSimulatePlayGame: () => void;
  onResetTestLock: () => void;
}

interface DailyRewardItem {
  day: number;
  coins: number;
  perk: string;
  icon: string;
}

function getJackpotRoll(): number {
  return 500 + Math.floor(Math.random() * 1500);
}

export function DailyRewardStrip({
  hasPlayedToday,
  dailyStreak,
  lastClaimDate,
  onClaim,
  onSimulatePlayGame,
  onResetTestLock,
}: DailyRewardStripProps) {
  const [claimCelebration, setClaimCelebration] = useState<{ coins: number; perk: string } | null>(null);

  // Daily Free Racing Perks state
  const [freeNitroRemaining, setFreeNitroRemaining] = useState<number>(3);
  const [adNitroWatchedToday, setAdNitroWatchedToday] = useState<number>(0);

  useEffect(() => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const saved = localStorage.getItem(`streetlife_nitro_${today}`);
      if (saved !== null) setFreeNitroRemaining(parseInt(saved, 10));
      const savedAds = localStorage.getItem(`streetlife_nitro_ads_${today}`);
      if (savedAds !== null) setAdNitroWatchedToday(parseInt(savedAds, 10));
    } catch {}
  }, []);

  // Prompt 12 Part C: 7-Day Rewards System
  const rewards: DailyRewardItem[] = [
    { day: 1, coins: 100, perk: '+1 Nitro Boost', icon: '⚡' },
    { day: 2, coins: 200, perk: '+2 Lucky Coins', icon: '🪙' },
    { day: 3, coins: 300, perk: '+1 Shooter Power-up', icon: '🎯' },
    { day: 4, coins: 400, perk: '+3 Nitro Boosts', icon: '⚡⚡' },
    { day: 5, coins: 500, perk: '+5 Slot Spins', icon: '🎰' },
    { day: 6, coins: 600, perk: '+1 Street Shield', icon: '🛡️' },
    { day: 7, coins: 1000, perk: 'JACKPOT (500-2000 SC)', icon: '👑' },
  ];

  const todayStr = new Date().toISOString().split('T')[0];
  const isAlreadyClaimedToday = lastClaimDate === todayStr;

  // Active day index in 0-6 (based on streak 1-7)
  const currentDayIndex = Math.min(Math.max((dailyStreak - 1) % 7, 0), 6);
  const currentRewardItem = rewards[currentDayIndex];

  const handleClaimClick = () => {
    if (!hasPlayedToday || isAlreadyClaimedToday) return;

    let finalCoins = currentRewardItem.coins;
    let extraPerk = currentRewardItem.perk;

    // Day 7 Jackpot Roll (500 to 2000 SC)
    if (currentRewardItem.day === 7) {
      const jackpotRoll = getJackpotRoll();
      finalCoins += jackpotRoll;
      extraPerk = `JACKPOT HIT! (+${jackpotRoll} Bonus SC!)`;
    }

    playSuccessSound();
    onClaim(finalCoins, extraPerk);
    setClaimCelebration({ coins: finalCoins, perk: extraPerk });

    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#F59E0B', '#10B981', '#FFFFFF'],
      });
    } catch {}

    setTimeout(() => {
      setClaimCelebration(null);
    }, 3500);
  };

  // Watch Ad for Free Racing Nitro (Max 5 per day)
  const handleWatchAdForNitro = () => {
    if (adNitroWatchedToday >= 5) return;
    playClickSound();
    const nextWatched = adNitroWatchedToday + 1;
    setAdNitroWatchedToday(nextWatched);
    const nextNitro = freeNitroRemaining + 1;
    setFreeNitroRemaining(nextNitro);

    if (typeof window !== 'undefined') {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(`streetlife_nitro_ads_${today}`, nextWatched.toString());
      localStorage.setItem(`streetlife_nitro_${today}`, nextNitro.toString());
    }
    playCoinSound();
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#151518] p-4 shadow-xl select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#FFD700]" />
          <h2 className="text-sm font-bold text-white tracking-wide">Daily Free System</h2>
          <span className="text-[11px] font-mono text-[#9CA3AF]">Day {((dailyStreak - 1) % 7) + 1}/7</span>
        </div>

        {/* Status indicator & Link to Full Daily Free Page */}
        <div className="flex items-center gap-2">
          <Link
            href="/daily-free"
            onClick={() => playClickSound()}
            className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-[#FFD700]/15 hover:bg-[#FFD700]/25 border border-[#FFD700]/40 text-[#FFD700] flex items-center gap-1 active:scale-95 transition-all"
          >
            <Gift className="w-3 h-3" />
            <span>All Daily Free</span>
          </Link>
          <div className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[#9CA3AF]">
            {isAlreadyClaimedToday ? 'Completed' : hasPlayedToday ? 'Unlocked' : 'Locked'}
          </div>
        </div>
      </div>

      {/* 7 Days Horizontal Scroll with Special Perks */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 no-scrollbar -mx-1 px-1">
        {rewards.map((item, idx) => {
          const isToday = idx === currentDayIndex;
          const isPast = idx < currentDayIndex || (isToday && isAlreadyClaimedToday);

          return (
            <div
              key={item.day}
              className={`flex flex-col items-center justify-between shrink-0 w-20 h-28 p-2 rounded-2xl transition-all border ${
                isToday
                  ? 'border-[#FFD700] bg-gradient-to-b from-[#FFD700]/20 via-[#FFD700]/5 to-black shadow-[0_0_15px_rgba(255,215,0,0.25)] scale-105'
                  : isPast
                  ? 'border-white/5 bg-white/[0.02] opacity-60'
                  : 'border-white/10 bg-[#1c1c22]'
              }`}
            >
              <span
                className={`text-[10px] font-bold tracking-tight ${
                  isToday ? 'text-[#FFD700]' : 'text-[#9CA3AF]'
                }`}
              >
                Day {item.day}
              </span>

              {/* Circle token with item emoji */}
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  isToday
                    ? 'bg-gradient-to-tr from-[#FFD700] to-[#FFF099] text-black shadow-md shadow-[#FFD700]/30'
                    : isPast
                    ? 'bg-white/10 text-emerald-400'
                    : 'bg-white/5 text-white/80'
                }`}
              >
                {isPast ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : item.icon}
              </div>

              {/* Coin Amount */}
              <div className="flex flex-col items-center">
                <span
                  className={`text-[11px] font-black tabular-nums ${
                    isToday ? 'text-[#FFD700]' : 'text-white/90'
                  }`}
                >
                  +{item.coins}
                </span>
                <span className="text-[8px] font-medium text-gray-400 text-center leading-tight line-clamp-1">
                  {item.day === 7 ? 'JACKPOT' : item.perk.split(' ')[1] || item.perk}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Celebration Popup Toast */}
      {claimCelebration && (
        <div className="my-2.5 p-3 rounded-2xl bg-[#FFD700]/15 border-2 border-[#FFD700] text-center text-xs text-[#FFD700] font-black animate-bounce shadow-[0_0_20px_rgba(255,215,0,0.3)]">
          🎉 Claimed +{claimCelebration.coins} SC & {claimCelebration.perk}! Resets after Day 7!
        </div>
      )}

      {/* CLAIM BUTTON */}
      <div className="mt-3">
        {isAlreadyClaimedToday ? (
          <button
            disabled
            className="w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-white/5 text-[#9CA3AF] border border-white/5 cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Claimed Today ✓ (Come Back Tomorrow)
          </button>
        ) : !hasPlayedToday ? (
          <button
            disabled
            className="w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-[#222228] text-[#9CA3AF] border border-white/5 cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            <Lock className="w-4 h-4 text-[#9CA3AF]" />
            Play 1 Game to Unlock 🔒
          </button>
        ) : (
          <button
            onClick={handleClaimClick}
            className="w-full py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-[#FFD700] via-[#FFC300] to-[#FFD700] text-black shadow-lg shadow-[#FFD700]/30 hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Gift className="w-4 h-4 text-black" />
            Claim Day {currentRewardItem.day}: {currentRewardItem.coins} SC {currentRewardItem.perk}
          </button>
        )}
      </div>

      {/* RACING & DAILY SYSTEM BONUSES (PART C SPECIFICATION) */}
      <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-[11px]">
        {/* FREE NITRO DAILY */}
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-cyan-400">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Free Nitro Daily</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {freeNitroRemaining} free daily charges left
            </p>
          </div>

          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
            <span className="text-[9px] text-gray-500">{adNitroWatchedToday}/5 Ads</span>
            <button
              onClick={handleWatchAdForNitro}
              disabled={adNitroWatchedToday >= 5}
              type="button"
              className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[9px] font-bold hover:bg-cyan-500/30 active:scale-95 disabled:opacity-50"
            >
              +1 Nitro (Ad)
            </button>
          </div>
        </div>

        {/* RACING COINS 2X MULTIPLIER */}
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-[#FFD700]">
              <Coins className="w-3.5 h-3.5 fill-current" />
              <span>Racing Coins 2X</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">First 5 road coins daily give 2x reward!</p>
          </div>

          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
            <span className="text-[9px] text-emerald-400 font-bold">ACTIVE TODAY</span>
            <span className="text-[9px] font-mono text-gray-400">5/5 Left</span>
          </div>
        </div>
      </div>

      {/* Testing Utilities */}
      <div className="mt-2.5 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2 text-[11px]">
        <div className="text-[#9CA3AF] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700]" />
          <span>Status:</span>
          <span className="font-semibold text-white">
            {hasPlayedToday ? 'Played (Unlocked)' : 'Not Played (Locked)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!hasPlayedToday ? (
            <button
              onClick={() => {
                playClickSound();
                onSimulatePlayGame();
              }}
              type="button"
              className="px-2.5 py-1 rounded-md bg-[#FFD700]/15 hover:bg-[#FFD700]/25 text-[#FFD700] font-bold text-[10px] tracking-wide border border-[#FFD700]/30 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              Simulate Play
            </button>
          ) : (
            <button
              onClick={() => {
                playClickSound();
                onResetTestLock();
              }}
              type="button"
              className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[#9CA3AF] text-[10px] border border-white/10 transition-colors cursor-pointer"
            >
              Re-Lock Test
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
