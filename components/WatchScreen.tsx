'use client';

import React, { useState, useEffect } from 'react';
import { UserGameState, NavTab } from '@/types/game';
import {
  claimWatchAdReward,
  showRewardedAd,
} from '@/lib/storage';
import { playClickSound, playCoinSound } from '@/lib/sound';
import confetti from 'canvas-confetti';
import {
  Eye,
  Play,
  Clock,
  Sparkles,
  Zap,
  ListChecks,
  CheckCircle2,
  Tv,
  X,
  Volume2,
  Gift,
  ArrowLeft,
} from 'lucide-react';
import { useLanguage } from '@/src/contexts/LanguageContext';

interface WatchScreenProps {
  gameState: UserGameState;
  onNavigateTab: (tab: NavTab) => void;
  onToast: (msg: string) => void;
  onBack?: () => void;
}

export function WatchScreen({ gameState, onNavigateTab, onToast, onBack }: WatchScreenProps) {
  const { t } = useLanguage();
  const [isPlayingAd, setIsPlayingAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(30);
  const [rewardModal, setRewardModal] = useState<{
    isOpen: boolean;
    amount: number;
    multiplier: number;
  }>({
    isOpen: false,
    amount: 10,
    multiplier: 1,
  });

  const [timeUntilReset, setTimeUntilReset] = useState<string>('5h 23m');
  const [boostRemaining, setBoostRemaining] = useState<string | null>(null);

  const adsWatchedToday = gameState.watchCountDaily ?? 0;
  const maxDailyAds = 33;
  const isLimitReached = adsWatchedToday >= maxDailyAds;

  // Active Multiplier: 1x, rewards 10 coins only
  const currentMultiplier = 1;
  const nextTarget = null;
  const nextMultiplier = null;

  // Countdown to reset (midnight local/UTC)
  useEffect(() => {
    const updateResetTime = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0);
      const diffMs = tomorrow.getTime() - now.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setTimeUntilReset(`${hours}h ${minutes}m`);

      // Check boost remaining
      if (gameState.boostUntil && gameState.boostUntil > Date.now()) {
        const boostDiff = gameState.boostUntil - Date.now();
        const bMinutes = Math.floor(boostDiff / 60000);
        const bSeconds = Math.floor((boostDiff % 60000) / 1000);
        setBoostRemaining(`${bMinutes}m ${bSeconds < 10 ? '0' : ''}${bSeconds}s`);
      } else {
        setBoostRemaining(null);
      }
    };

    updateResetTime();
    const interval = setInterval(updateResetTime, 1000);
    return () => clearInterval(interval);
  }, [gameState.boostUntil]);

  // Handle Starting Ad Simulation
  const handleStartAd = () => {
    if (isLimitReached) {
      onToast('Daily limit reached! Come back after reset.');
      return;
    }

    playClickSound();
    setIsPlayingAd(true);
    setAdCountdown(30);

    // Call ad network placeholder as required by prompt
    showRewardedAd().catch(() => {});
  };

  // Ad Completion
  const handleCompleteAd = React.useCallback(() => {
    setIsPlayingAd(false);

    // Claim reward through storage logic (10 coins only)
    const res = claimWatchAdReward(10);

    if (res.success) {
      playCoinSound();

      // Trigger Confetti Celebration
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FFA500', '#FFFFFF', '#A855F7'],
        });
      } catch {}

      setRewardModal({
        isOpen: true,
        amount: res.reward,
        multiplier: res.multiplier,
      });

      if (res.boostActivated) {
        onToast('🚀 1-Hour 2x Boost Activated!');
      }
    } else {
      onToast('Ad limit reached for today!');
    }
  }, [onToast]);

  // Timer loop for Ad Countdown (30, 29, 28... -> 0)
  useEffect(() => {
    if (!isPlayingAd) return;

    const timer = setInterval(() => {
      setAdCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimeout(() => {
            handleCompleteAd();
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlayingAd, handleCompleteAd]);

  // Fast skip option for testing
  const handleSkipTest = () => {
    handleCompleteAd();
  };

  return (
    <div className="w-full min-h-[calc(100dvh-5rem)] flex-1 overflow-y-auto pb-40 pt-4 px-4 overscroll-contain select-none flex flex-col space-y-4 animate-fadeIn">
      {/* HEADER: Title: "WATCH & EARN" with eye icon gold */}
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
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/30">
                <Eye className="w-5 h-5 text-[#FFD700]" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-wider text-white uppercase">
                WATCH &amp; EARN
              </h1>
            </div>
            <p className="text-xs text-[#9CA3AF] font-medium tracking-wide mt-0.5">
              Watch short video sponsors • Earn instant Street Coins
            </p>
          </div>
        </div>

        {/* Current Active Ad Counter Badge */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            AD COUNTER
          </span>
          <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-[#FFD700] text-black shadow-[0_0_8px_rgba(255,215,0,0.5)]">
            Ad {Math.min(33, adsWatchedToday + 1)}/33
          </span>
        </div>
      </div>

      {/* DAILY LIMIT BAR: "Ad 1/33" + progress gold bar, Reset in 5h 23m */}
      <div className="rounded-2xl bg-gradient-to-br from-[#16161C] to-[#0D0D10] border border-[#FFD700]/30 p-4 shadow-lg">
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 text-[#FFD700]" />
            <span className="font-extrabold text-white text-sm">
              Ad {Math.min(33, adsWatchedToday + 1)}/33 ({adsWatchedToday}/{maxDailyAds} Watched)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>Reset in {timeUntilReset}</span>
          </div>
        </div>

        {/* Progress Gold Bar */}
        <div className="w-full h-3.5 bg-black/70 rounded-full overflow-hidden p-0.5 border border-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-[#FFD700] to-yellow-300 shadow-[0_0_10px_rgba(255,215,0,0.6)] transition-all duration-500"
            style={{ width: `${Math.min(100, (adsWatchedToday / maxDailyAds) * 100)}%` }}
          />
        </div>

        {/* 10 Coins Only Info */}
        <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-white/5">
          <div className="flex items-center gap-1 text-gray-300">
            <Sparkles className="w-3.5 h-3.5 text-[#FFD700]" />
            <span>Earn 10 Street Coins per video sponsor</span>
          </div>
          <span className="font-mono font-bold text-[#FFD700]">
            +10 Coins / ad
          </span>
        </div>
      </div>

      {/* BIG CARD CENTER: Play button gold glowing, text "Watch Ad +10 S", timer 30s */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#1C1C24] via-[#121217] to-[#0A0A0E] border-2 border-[#FFD700]/50 p-6 shadow-[0_0_30px_rgba(255,215,0,0.18)] text-center flex flex-col items-center">
        {/* Ambient Gold Radial Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#FFD700]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full flex flex-col items-center">
          {/* Tag */}
          <span className="text-[11px] font-black uppercase tracking-widest text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/30 px-3 py-1 rounded-full mb-4">
            REWARDED SPONSOR VIDEO • AD {Math.min(33, adsWatchedToday + 1)}/33
          </span>

          {/* Glowing Gold Play Button */}
          <button
            type="button"
            disabled={isLimitReached}
            onClick={handleStartAd}
            className={`group relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer select-none touch-manipulation my-2 ${
              isLimitReached
                ? 'opacity-40 cursor-not-allowed bg-gray-800 border border-gray-600'
                : 'bg-gradient-to-tr from-[#E5C100] via-[#FFD700] to-[#FFF385] text-black shadow-[0_0_25px_#FFD700] hover:scale-110 active:scale-95'
            }`}
          >
            {/* Outer pulsating ring */}
            {!isLimitReached && (
              <div className="absolute inset-0 rounded-full border-2 border-[#FFD700] animate-ping opacity-30 pointer-events-none" />
            )}
            <Play className="w-10 h-10 fill-current ml-1 transition-transform group-hover:scale-110" />
          </button>

          {/* Text: Watch Ad +10 S */}
          <h2 className="text-2xl font-black text-white tracking-wide mt-4 flex items-center justify-center gap-2">
            Watch Ad{' '}
            <span className="text-[#FFD700] drop-shadow-[0_0_10px_rgba(255,215,0,0.6)]">
              +10 SC
            </span>
          </h2>

          {/* Timer: 30s badge */}
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 font-mono">
            <Clock className="w-3.5 h-3.5 text-[#FFD700]" />
            <span>Duration: 30s</span>
          </div>

          {/* Action CTA Button */}
          <button
            type="button"
            disabled={isLimitReached}
            onClick={handleStartAd}
            className={`w-full max-w-xs mt-6 py-3.5 px-6 rounded-2xl font-black text-sm tracking-wider uppercase transition-all duration-200 cursor-pointer select-none touch-manipulation flex items-center justify-center gap-2 ${
              isLimitReached
                ? 'bg-gray-800 text-gray-500 border border-white/10 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#FFD700] via-[#FFA500] to-[#FFD700] text-black shadow-[0_0_15px_rgba(255,215,0,0.5)] hover:brightness-110 active:scale-95'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            {isLimitReached ? 'DAILY LIMIT REACHED (33/33)' : `WATCH AD ${Math.min(33, adsWatchedToday + 1)}/33 (+10 SC)`}
          </button>
        </div>
      </div>

      {/* BONUS MULTIPLIERS CARD: 2x if watch 5 ads, 3x if watch 10 */}
      <div className="rounded-2xl bg-[#14141A] border border-[#FFD700]/30 p-4">
        <h3 className="text-xs font-black tracking-wider text-white uppercase mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#FFD700]" />
          DAILY BONUS MULTIPLIERS
        </h3>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Tier 1: 2x at 5 ads */}
          <div
            className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
              adsWatchedToday >= 5
                ? 'bg-amber-950/40 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                : 'bg-black/40 border-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400">TIER 1 (5 ADS)</span>
              {adsWatchedToday >= 5 && (
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
              )}
            </div>
            <div className="my-1.5">
              <div className="text-xl font-black text-amber-400">2x COINS</div>
              <p className="text-[10px] text-gray-300">+1,000 S per view</p>
            </div>
            <span className="text-[9px] font-mono text-gray-400">
              {adsWatchedToday >= 5 ? 'ACTIVE NOW' : `${adsWatchedToday}/5 Watched`}
            </span>
          </div>

          {/* Tier 2: 3x at 10 ads */}
          <div
            className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
              adsWatchedToday >= 10
                ? 'bg-purple-950/40 border-purple-500/60 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                : 'bg-black/40 border-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400">TIER 2 (10 ADS)</span>
              {adsWatchedToday >= 10 && (
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
              )}
            </div>
            <div className="my-1.5">
              <div className="text-xl font-black text-purple-400">3x COINS</div>
              <p className="text-[10px] text-gray-300">+1,500 S per view</p>
            </div>
            <span className="text-[9px] font-mono text-gray-400">
              {adsWatchedToday >= 10 ? 'ACTIVE NOW' : `${adsWatchedToday}/10 Watched`}
            </span>
          </div>
        </div>
      </div>

      {/* CARDS BELOW: "Watch 2 Ads Task" linked to TASKS, "Boost x2 for 1 hour after 5 ads" */}
      <div className="space-y-2.5">
        {/* Card 1: Watch 2 Ads Task linked to TASKS */}
        <div
          onClick={() => {
            playClickSound();
            onNavigateTab('TASKS');
          }}
          className="rounded-2xl bg-gradient-to-r from-[#171720] to-[#121217] border border-white/10 hover:border-[#FFD700]/50 p-4 flex items-center justify-between transition-all cursor-pointer group active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
              <ListChecks className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-white group-hover:text-[#FFD700] transition-colors">
                  Watch 2 Ads Task
                </h4>
                {adsWatchedToday >= 2 ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-gray-400">
                    {adsWatchedToday}/2
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Complete daily challenge in TASKS tab • +1,000 S
              </p>
            </div>
          </div>
          <button
            type="button"
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-[#FFD700] hover:text-black text-xs font-black uppercase tracking-wider text-gray-200 transition-all"
          >
            OPEN
          </button>
        </div>

        {/* Card 2: Boost x2 for 1 hour after 5 ads */}
        <div className="rounded-2xl bg-gradient-to-r from-[#191624] to-[#110F1B] border border-amber-500/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-white">
                  Boost x2 for 1 hour
                </h4>
                {boostRemaining ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    ⚡ {boostRemaining}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                    After 5 Ads
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Double coins in Galaxy Shooter, Street Race &amp; Delivery
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono font-bold text-amber-400">
              {adsWatchedToday >= 5 ? 'UNLOCKED' : `${adsWatchedToday}/5`}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SIMULATED AD PLAYING OVERLAY (30s Countdown, Black Screen) */}
      {/* ============================================================== */}
      {isPlayingAd && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col justify-between p-4 animate-fadeIn select-none">
          {/* Top Ad Navigation Bar */}
          <div className="flex items-center justify-between z-10 pt-safe">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded bg-white/20 text-white tracking-widest uppercase">
                SPONSOR AD
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-[#FFD700]" />
                Reward in {adCountdown}s
              </span>
            </div>

            {/* Test Fast-Forward / Skip Button */}
            <button
              type="button"
              onClick={handleSkipTest}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-black text-[#FFD700] tracking-wider uppercase flex items-center gap-1 cursor-pointer"
            >
              SKIP / CLAIM NOW
            </button>
          </div>

          {/* Central Black Screen: "Ad Playing..." with high-energy sponsor animation */}
          <div className="my-auto flex flex-col items-center justify-center text-center px-4">
            {/* Animated Pulsing Video Screen Frame */}
            <div className="relative w-full max-w-sm aspect-video rounded-2xl bg-[#09090D] border-2 border-[#FFD700]/60 p-6 flex flex-col items-center justify-center overflow-hidden shadow-[0_0_40px_rgba(255,215,0,0.25)]">
              {/* Scanlines / Retro Cyber CRT filter */}
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, #FFD700 0px, #FFD700 1px, transparent 1px, transparent 4px)',
                }}
              />

              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/40 flex items-center justify-center text-[#FFD700] mb-3 animate-bounce">
                  <Tv className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-white tracking-wider uppercase mb-1">
                  Ad Playing...
                </h3>
                <p className="text-xs text-[#FFD700] font-mono tracking-wide">
                  SPONSORED BY THE STREET SYNDICATE
                </p>

                {/* Big Live Countdown */}
                <div className="mt-4 text-4xl font-black font-mono text-white tracking-widest drop-shadow-[0_0_12px_rgba(255,215,0,0.8)]">
                  {adCountdown}s
                </div>
              </div>

              {/* Progress bar at bottom of ad container */}
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-[#FFD700] transition-all duration-1000 ease-linear"
                  style={{ width: `${((30 - adCountdown) / 30) * 100}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-4 max-w-xs">
              Keep app open while sponsor video finishes to claim your street coin bounty.
            </p>
          </div>

          {/* Bottom Audio & Status */}
          <div className="flex items-center justify-between text-xs text-gray-400 pb-safe z-10">
            <span className="flex items-center gap-1">
              <Volume2 className="w-4 h-4 text-[#FFD700]" /> High Definition Stream
            </span>
            <span className="font-mono text-[#FFD700]">Adsgram / OnClickA API</span>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* REWARD CLAIMED POPUP + CONFETTI */}
      {/* ============================================================== */}
      {rewardModal.isOpen && (
        <div className="fixed inset-0 z-[250] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#1C1C24] to-[#0E0E12] border-2 border-[#FFD700] p-6 text-center shadow-[0_0_35px_rgba(255,215,0,0.35)]">
            <button
              type="button"
              onClick={() => setRewardModal({ ...rewardModal, isOpen: false })}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Gift icon with golden burst */}
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-[#FFD700] to-yellow-200 flex items-center justify-center text-black mb-4 shadow-[0_0_20px_#FFD700] animate-bounce">
              <Gift className="w-10 h-10 stroke-[2.5]" />
            </div>

            <span className="text-[11px] font-black uppercase tracking-widest text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/30 px-3 py-1 rounded-full">
              REWARD UNLOCKED
            </span>

            {/* Title: "+500 S CLAIMED" */}
            <h3 className="text-3xl font-black text-white mt-3 mb-1 tracking-tight">
              +{rewardModal.amount.toLocaleString()} S CLAIMED
            </h3>

            {rewardModal.multiplier > 1 && (
              <p className="text-xs text-amber-400 font-bold mb-3">
                Includes {rewardModal.multiplier}x Daily Tier Bonus!
              </p>
            )}

            <p className="text-xs text-gray-400 mb-6">
              Street Coins added directly to your Syndicate balance.
            </p>

            <button
              type="button"
              onClick={() => {
                playClickSound();
                setRewardModal({ ...rewardModal, isOpen: false });
              }}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#FFD700] to-[#E5C100] text-black font-black text-sm uppercase tracking-wider shadow-[0_0_15px_rgba(255,215,0,0.5)] active:scale-95 transition-all"
            >
              COLLECT &amp; CONTINUE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
