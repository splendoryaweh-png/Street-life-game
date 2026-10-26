'use client';

import React, { useState, useEffect } from 'react';
import { UserGameState, BankTarget, RobberyToolId } from '@/types/game';
import { BANK_TARGETS, ROBBERY_TOOLS, calculateRobberySuccessChance } from '@/lib/bank-config';
import {
  startBankRobbery,
  completeBankRobbery,
  fastForwardActiveRobbery,
  payPoliceBribe,
  watchAdToSkipCooldown,
  buyRobberyTool,
} from '@/lib/storage';
import {
  playCoinSound,
  playSirenSound,
  playClickSound,
  playSuccessSound,
  playBribeSound,
} from '@/lib/sound';
import { ToolsShopModal } from './ToolsShopModal';
import { AdsgramModal } from './AdsgramModal';
import {
  Flame,
  ShieldAlert,
  Coins,
  Lock,
  Play,
  ShoppingBag,
  Store,
  Fuel,
  Landmark,
  Shield,
  Siren,
  Clock,
  Sparkles,
  Zap,
  Wrench,
  Crosshair,
  Car,
  Users,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface BankRobberyScreenProps {
  gameState: UserGameState;
  onToast: (msg: string) => void;
}

export function BankRobberyScreen({ gameState, onToast }: BankRobberyScreenProps) {
  const [selectedBank, setSelectedBank] = useState<BankTarget | null>(null);
  const [isToolsShopOpen, setIsToolsShopOpen] = useState(false);
  const [highlightTool, setHighlightTool] = useState<RobberyToolId | null>(null);
  const [isAdsgramOpen, setIsAdsgramOpen] = useState(false);
  const [robberyResultModal, setRobberyResultModal] = useState<{
    show: boolean;
    isSuccess: boolean;
    reward: number;
    heatAdded: number;
  } | null>(null);

  // Active robbery timer state
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Ticking effect for active robbery countdown and cooldown countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      // 1. Active Robbery Countdown
      if (gameState.activeRobbery) {
        const elapsedSec = Math.floor((now - gameState.activeRobbery.startTime) / 1000);
        const remaining = Math.max(0, gameState.activeRobbery.durationSeconds - elapsedSec);
        setSecondsRemaining(remaining);

        if (remaining <= 0) {
          // Timer finished -> auto complete robbery
          const res = completeBankRobbery();
          if (res.isSuccess) {
            playSuccessSound();
            playCoinSound();
          } else {
            playSirenSound();
          }
          setRobberyResultModal({
            show: true,
            isSuccess: res.isSuccess,
            reward: res.reward,
            heatAdded: res.heatAdded,
          });
        }
      } else {
        setSecondsRemaining(0);
      }

      // 2. Cooldown Countdown
      if (gameState.cooldownUntil) {
        const remainingMs = gameState.cooldownUntil - now;
        if (remainingMs > 0) {
          setCooldownRemaining(Math.ceil(remainingMs / 1000));
        } else {
          setCooldownRemaining(0);
        }
      } else {
        setCooldownRemaining(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.activeRobbery, gameState.cooldownUntil]);

  const handleBankClick = (bank: BankTarget) => {
    playClickSound();
    if (!gameState.unlockedBanks.includes(bank.id)) {
      onToast(`Beat Level ${bank.id - 1} first to unlock ${bank.name}!`);
      return;
    }

    if (cooldownRemaining > 0) {
      onToast(`Police heat is too high! Wait for cooldown or watch an ad.`);
      return;
    }

    // Check tools requirement
    const missingTools = bank.requiredToolIds.filter(
      (tid) => !gameState.ownedTools.includes(tid)
    );

    if (missingTools.length > 0) {
      setHighlightTool(missingTools[0]);
      setIsToolsShopOpen(true);
      onToast(`Missing ${ROBBERY_TOOLS[missingTools[0]].name}! Purchase it from the armory.`);
      return;
    }

    setSelectedBank(bank);
  };

  const handleStartRobbery = (bank: BankTarget) => {
    playClickSound();
    const chance = calculateRobberySuccessChance(gameState.ownedTools, gameState.heatLevel);
    const res = startBankRobbery(
      bank.id,
      bank.durationSeconds,
      bank.reward,
      bank.heatIncrease,
      chance.totalChance
    );

    if (res.success) {
      setSelectedBank(null);
      onToast(`🚨 Robbery of ${bank.name} started! Keep your head down...`);
    } else {
      onToast(res.message);
    }
  };

  const handleBuyTool = (toolId: RobberyToolId, price: number) => {
    const res = buyRobberyTool(toolId, price);
    if (res.success) {
      playCoinSound();
    } else {
      playClickSound();
    }
    onToast(res.message);
  };

  const handlePayBribe = () => {
    playClickSound();
    const res = payPoliceBribe();
    if (res.success) {
      playBribeSound();
    }
    onToast(res.message);
  };

  const handleWatchAdSkip = () => {
    playClickSound();
    setIsAdsgramOpen(true);
  };

  const handleAdFinished = () => {
    const res = watchAdToSkipCooldown();
    if (res.success) {
      playCoinSound();
    }
    onToast(res.message);
  };

  const handleFastForward = () => {
    playClickSound();
    const res = fastForwardActiveRobbery();
    if (res) {
      if (res.isSuccess) {
        playSuccessSound();
        playCoinSound();
      } else {
        playSirenSound();
      }
      setRobberyResultModal({
        show: true,
        isSuccess: res.isSuccess,
        reward: res.reward,
        heatAdded: res.heatAdded,
      });
      onToast(res.isSuccess ? '⚡ Heist pulled off cleanly!' : '🚨 Police ambushed the crew! Caught!');
    }
  };

  const getBankIcon = (name: string) => {
    switch (name) {
      case 'Local Kiosk':
        return Store;
      case 'Mini Mart':
        return ShoppingBag;
      case 'Gas Station':
        return Fuel;
      case 'City Bank':
        return Landmark;
      case 'Federal Vault':
        return Shield;
      default:
        return Landmark;
    }
  };

  const getToolIcon = (id: RobberyToolId) => {
    switch (id) {
      case 'crowbar':
        return Wrench;
      case 'mask':
        return Shield;
      case 'gun':
        return Crosshair;
      case 'driver':
        return Car;
      case 'full_crew':
        return Users;
      default:
        return Wrench;
    }
  };

  // Police Heat Colors
  const heatLevel = gameState.heatLevel;
  const isHighHeat = heatLevel > 80;
  const isBusted = heatLevel >= 100 || gameState.cooldownReason === 'BUSTED_100';

  // Format cooldown mm:ss
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="space-y-4">
      {/* ================= TOP SECTION ================= */}
      <div className="rounded-2xl border border-white/10 bg-[#151515] p-4 shadow-xl space-y-3.5">
        {/* Header Strip: Level Progress & Cash */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#9CA3AF] tracking-wider uppercase font-semibold">
              Robbery Mastery
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-sm font-black text-white">
                Tier {Math.min(5, gameState.unlockedBanks.length)} / 5
              </span>
              <div className="flex gap-1 ml-1">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <span
                    key={lvl}
                    className={`w-2 h-2 rounded-full ${
                      gameState.unlockedBanks.includes(lvl)
                        ? 'bg-[#FFD700] shadow-[0_0_6px_#FFD700]'
                        : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-[#9CA3AF] tracking-wider uppercase font-semibold">
              Current Stash
            </span>
            <div className="flex items-center gap-1.5 justify-end mt-0.5 font-mono">
              <Coins className="w-4 h-4 text-[#FFD700]" />
              <span className="text-sm sm:text-base font-extrabold text-[#FFD700] tabular-nums">
                {gameState.streetCoin.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* POLICE HEAT BAR (0 - 100%) */}
        <div className="space-y-1.5 pt-1 border-t border-white/5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Flame
                className={`w-4 h-4 ${
                  isBusted
                    ? 'text-red-500 animate-bounce'
                    : isHighHeat
                    ? 'text-orange-500 animate-pulse'
                    : 'text-amber-400'
                }`}
              />
              <span className="font-bold text-white tracking-wide">
                Police Heat Level
              </span>
              {isHighHeat && !isBusted && (
                <span className="text-[9px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/15 px-1.5 py-0.2 rounded border border-orange-500/30">
                  -20% Chance Penalty
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#9CA3AF] font-mono">
                Decays -1% / 2m
              </span>
              <span
                className={`font-mono font-bold tabular-nums text-xs ${
                  isBusted
                    ? 'text-red-500'
                    : isHighHeat
                    ? 'text-orange-400'
                    : 'text-[#FFD700]'
                }`}
              >
                {heatLevel}%
              </span>
            </div>
          </div>

          {/* Progress track */}
          <div className="h-3 w-full rounded-full bg-black/60 p-0.5 border border-white/10 relative overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isBusted
                  ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_10px_#ef4444]'
                  : isHighHeat
                  ? 'bg-gradient-to-r from-amber-500 to-red-500'
                  : 'bg-gradient-to-r from-emerald-500 via-[#FFD700] to-amber-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(2, heatLevel))}%` }}
            />
          </div>
        </div>

        {/* BUSTED OR COOLDOWN BANNER */}
        {cooldownRemaining > 0 && (
          <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/40 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-red-400 font-bold">
                <Siren className="w-4 h-4 animate-spin text-red-500" />
                <span>
                  {gameState.cooldownReason === 'BUSTED_100'
                    ? 'BUSTED BY S.W.A.T. (100% Heat)'
                    : 'HEIST BLOWN! IN HIDING'}
                </span>
              </div>
              <span className="font-mono font-bold text-white text-xs">
                {formatTime(cooldownRemaining)}
              </span>
            </div>

            <p className="text-[11px] text-[#9CA3AF] leading-snug">
              {gameState.cooldownReason === 'BUSTED_100'
                ? 'The feds locked down your crew for 10 minutes. Pay a 300 coin bribe to reduce heat to 50% or skip.'
                : 'Cops are scouring the neighborhood. Wait 5 minutes or watch a sponsor video to clear heat.'}
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleWatchAdSkip}
                type="button"
                className="flex-1 py-2 px-2.5 rounded-lg bg-emerald-500 text-black font-black text-[11px] tracking-wide uppercase hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Watch Ad (Skip)
              </button>

              {gameState.streetCoin >= 300 && (
                <button
                  onClick={handlePayBribe}
                  type="button"
                  className="flex-1 py-2 px-2.5 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#FFC300] text-black font-black text-[11px] tracking-wide uppercase hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1"
                >
                  <Coins className="w-3.5 h-3.5" />
                  Bribe 300 (Heat 50%)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quick Tools Armory Shortcut */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <div className="flex items-center gap-1.5 text-[#9CA3AF]">
            <span>Owned Gear:</span>
            <div className="flex gap-1">
              {gameState.ownedTools.length === 0 ? (
                <span className="text-[10px] text-white/50">None</span>
              ) : (
                Array.from(new Set(gameState.ownedTools)).map((t) => {
                  const ToolIcon = getToolIcon(t);
                  const count = gameState.ownedTools.filter((id) => id === t).length;
                  return (
                    <div
                      key={t}
                      className="relative w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30"
                      title={`${ROBBERY_TOOLS[t]?.name} (Possess: ${count})`}
                    >
                      <ToolIcon className="w-3.5 h-3.5" />
                      {count > 1 && (
                        <span className="absolute -top-1 -right-1 px-1 rounded-full bg-[#FFD700] text-black font-mono font-black text-[8px] leading-tight shadow-sm">
                          {count}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            onClick={() => {
              setHighlightTool(null);
              setIsToolsShopOpen(true);
            }}
            type="button"
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[#FFD700] font-bold text-[11px] border border-white/10 transition-colors flex items-center gap-1"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Armory Shop
          </button>
        </div>
      </div>

      {/* ================= ACTIVE ROBBERY IN PROGRESS MODAL ================= */}
      {gameState.activeRobbery && (
        <div className="rounded-2xl border-2 border-[#FFD700] bg-gradient-to-b from-[#1c1c1c] to-[#111] p-4 shadow-[0_0_25px_rgba(255,215,0,0.25)] space-y-3 animate-pulse-slow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#FFD700] text-black flex items-center justify-center animate-spin">
                <Siren className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-[#FFD700] tracking-wide uppercase">
                  Heist in Progress
                </h3>
                <span className="text-sm font-bold text-white">
                  {BANK_TARGETS.find((b) => b.id === gameState.activeRobbery?.bankId)?.name || 'Target'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-[#9CA3AF] block font-mono">
                Countdown
              </span>
              <span className="text-lg font-mono font-black text-[#FFD700] tabular-nums">
                {formatTime(secondsRemaining)}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full rounded-full bg-black/60 border border-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FFD700] to-[#FFC300] transition-all duration-1000"
              style={{
                width: `${
                  100 -
                  (secondsRemaining / (gameState.activeRobbery.durationSeconds || 1)) * 100
                }%`,
              }}
            />
          </div>

          {/* Success Chance & Test Fast-Forward */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-[11px] text-[#9CA3AF]">
              Estimated Success Chance:{' '}
              <strong className="text-emerald-400 font-mono">
                {gameState.activeRobbery.successChance}%
              </strong>
            </span>

            {/* Fast-forward for instant testing without waiting */}
            <button
              onClick={handleFastForward}
              type="button"
              className="px-2.5 py-1 rounded-md bg-[#FFD700]/20 hover:bg-[#FFD700]/30 text-[#FFD700] font-bold text-[10px] tracking-wide border border-[#FFD700]/40 flex items-center gap-1 active:scale-95 transition-all"
            >
              <Zap className="w-3 h-3 fill-current" />
              Fast-Forward ⚡
            </button>
          </div>
        </div>
      )}

      {/* ================= 5 BANKS AS CARDS ================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#FFD700]" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              Bank Targets ({BANK_TARGETS.length})
            </h2>
          </div>
          <span className="text-[10px] font-mono text-[#9CA3AF]">
            Higher Tier = Bigger Loot
          </span>
        </div>

        <div className="space-y-2.5">
          {BANK_TARGETS.map((bank) => {
            const Icon = getBankIcon(bank.name);
            const isUnlocked = gameState.unlockedBanks.includes(bank.id);
            const missingTools = bank.requiredToolIds.filter(
              (tid) => !gameState.ownedTools.includes(tid)
            );
            const hasAllTools = missingTools.length === 0;
            const chance = calculateRobberySuccessChance(gameState.ownedTools, gameState.heatLevel);

            return (
              <div
                key={bank.id}
                className={`rounded-2xl p-4 transition-all relative overflow-hidden border ${
                  !isUnlocked
                    ? 'border-white/5 bg-[#151515]/60 opacity-60'
                    : bank.id === 5
                    ? 'border-2 border-[#FFD700] bg-gradient-to-b from-[#FFD700]/10 via-[#151515] to-[#121212] shadow-[0_0_20px_rgba(255,215,0,0.15)]'
                    : 'border-white/10 bg-[#151515] hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Icon + Level info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        !isUnlocked
                          ? 'bg-white/5 text-[#9CA3AF] border border-white/5'
                          : bank.id === 5
                          ? 'bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/50'
                          : 'bg-white/5 text-[#FFD700] border border-white/10'
                      }`}
                    >
                      {isUnlocked ? <Icon className="w-6 h-6" /> : <Lock className="w-5 h-5 text-[#9CA3AF]" />}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#FFD700] bg-[#FFD700]/15 px-1.5 py-0.2 rounded border border-[#FFD700]/30">
                          Level {bank.level}
                        </span>
                        <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                          {bank.name}
                        </h3>
                      </div>

                      <p className="text-[11px] text-[#9CA3AF] leading-tight">
                        {bank.description}
                      </p>

                      {/* Stat chips: Reward, Duration, Heat */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px]">
                        <span className="font-mono font-bold text-[#FFD700] flex items-center gap-1">
                          <Coins className="w-3 h-3" />
                          +{bank.reward.toLocaleString()}
                        </span>
                        <span className="text-[#9CA3AF] flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          {bank.durationLabel}
                        </span>
                        <span className="text-red-400 flex items-center gap-1 font-mono">
                          <Flame className="w-3 h-3" />
                          +{bank.heatIncrease}% Heat
                        </span>
                      </div>

                      {/* Required Tools check */}
                      {bank.requiredToolIds.length > 0 && (
                        <div className="pt-1 flex items-center gap-1.5 text-[10px]">
                          <span className="text-[#9CA3AF]">Tools:</span>
                          <div className="flex flex-wrap gap-1">
                            {bank.requiredToolIds.map((tid) => {
                              const tool = ROBBERY_TOOLS[tid];
                              const owned = gameState.ownedTools.includes(tid);
                              return (
                                <span
                                  key={tid}
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-semibold flex items-center gap-1 ${
                                    owned
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-red-500/15 text-red-400 border border-red-500/30'
                                  }`}
                                >
                                  {owned ? (
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                  ) : (
                                    <Lock className="w-2.5 h-2.5" />
                                  )}
                                  {tool.name}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Action Button */}
                  <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5">
                    {!isUnlocked ? (
                      <div className="px-3 py-1.5 rounded-xl bg-white/5 text-[#9CA3AF] text-xs font-semibold flex items-center gap-1 border border-white/5">
                        <Lock className="w-3 h-3" />
                        Locked
                      </div>
                    ) : !hasAllTools ? (
                      <button
                        onClick={() => handleBankClick(bank)}
                        type="button"
                        className="px-3 py-1.5 rounded-xl bg-[#FFD700]/15 hover:bg-[#FFD700]/25 text-[#FFD700] text-xs font-bold border border-[#FFD700]/30 transition-all flex items-center gap-1 active:scale-95"
                      >
                        <ShoppingBag className="w-3 h-3" />
                        Buy Gear
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBankClick(bank)}
                        disabled={cooldownRemaining > 0 || !!gameState.activeRobbery}
                        type="button"
                        className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                          cooldownRemaining > 0 || gameState.activeRobbery
                            ? 'bg-white/5 text-[#9CA3AF] cursor-not-allowed border border-white/5'
                            : 'bg-gradient-to-r from-[#FFD700] via-[#FFC300] to-[#FFD700] text-black shadow-md shadow-[#FFD700]/20 hover:brightness-110 active:scale-95'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Rob
                      </button>
                    )}

                    {isUnlocked && (
                      <span className="text-[9px] font-mono text-emerald-400">
                        {chance.totalChance}% Success
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= ROBBERY PREPARATION / CONFIRM MODAL ================= */}
      {selectedBank && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-[#151515] border-2 border-[#FFD700] p-6 shadow-2xl text-left space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Siren className="w-5 h-5 text-[#FFD700]" />
                <h3 className="text-base font-black text-white">
                  Confirm Bank Heist
                </h3>
              </div>
              <button
                onClick={() => setSelectedBank(null)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-[#9CA3AF] hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">{selectedBank.name}</span>
                <span className="font-mono text-[#FFD700] font-bold">
                  +{selectedBank.reward.toLocaleString()} coins
                </span>
              </div>
              <p className="text-[11px] text-[#9CA3AF] leading-snug">
                {selectedBank.description}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono">
                <div className="text-[#9CA3AF]">
                  Duration: <span className="text-white">{selectedBank.durationLabel}</span>
                </div>
                <div className="text-red-400 text-right">
                  Heat: +{selectedBank.heatIncrease}%
                </div>
              </div>
            </div>

            {/* Success Probability Breakdown */}
            {(() => {
              const chance = calculateRobberySuccessChance(
                gameState.ownedTools,
                gameState.heatLevel
              );
              return (
                <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">Success Probability:</span>
                    <span className="font-mono font-black text-emerald-400 text-sm">
                      {chance.totalChance}%
                    </span>
                  </div>
                  <div className="text-[10px] text-[#9CA3AF] space-y-0.5">
                    <div className="flex justify-between">
                      <span>Base rate:</span>
                      <span className="font-mono">+{chance.baseChance}%</span>
                    </div>
                    <div className="flex justify-between text-emerald-400">
                      <span>Equipped Tools bonus ({gameState.ownedTools.length}):</span>
                      <span className="font-mono">+{chance.toolBonus}%</span>
                    </div>
                    {chance.heatPenalty > 0 && (
                      <div className="flex justify-between text-red-400">
                        <span>High Police Heat penalty (&gt;80%):</span>
                        <span className="font-mono">-{chance.heatPenalty}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setSelectedBank(null)}
                type="button"
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-[#9CA3AF] border border-white/5 transition-colors"
              >
                Abort
              </button>
              <button
                onClick={() => handleStartRobbery(selectedBank)}
                type="button"
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFC300] text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-[#FFD700]/20 hover:brightness-110 active:scale-95 transition-all"
              >
                START ROBBERY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ROBBERY RESULT MODAL (SUCCESS OR CAUGHT) ================= */}
      {robberyResultModal && robberyResultModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-[#151515] border-2 p-6 shadow-2xl text-center space-y-4 border-opacity-60">
            {robberyResultModal.isSuccess ? (
              /* SUCCESS SCREEN */
              <>
                <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <Coins className="w-8 h-8 text-[#FFD700]" />
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Heist Pulled Off Clean
                  </div>
                  <h3 className="text-xl font-black text-white">
                    LOOT SECURED! 💰
                  </h3>
                  <p className="text-xs text-[#9CA3AF]">
                    You cracked the safe and slipped away before police sirens arrived.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1 font-mono text-xs">
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Reward Added:</span>
                    <span>+{robberyResultModal.reward.toLocaleString()} coins</span>
                  </div>
                  <div className="flex justify-between text-red-400">
                    <span>Police Heat Added:</span>
                    <span>+{robberyResultModal.heatAdded}%</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    playClickSound();
                    setRobberyResultModal(null);
                  }}
                  type="button"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFC300] text-black font-black text-xs uppercase tracking-wider shadow-md hover:brightness-110 active:scale-95 cursor-pointer"
                >
                  Deposit Loot in Stash
                </button>
              </>
            ) : (
              /* CAUGHT SCREEN */
              <>
                <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                  <Siren className="w-8 h-8 text-red-500 animate-spin" />
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                    Alarm Triggered
                  </div>
                  <h3 className="text-xl font-black text-white">
                    CAUGHT BY POLICE! 🚨
                  </h3>
                  <p className="text-xs text-[#9CA3AF]">
                    Guards spotted your crew! Heat jumped +50% and you are on 5 min cooldown.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-red-950/20 border border-red-500/30 space-y-1 font-mono text-xs text-left">
                  <div className="flex justify-between text-red-400">
                    <span>Heat Spike:</span>
                    <span>+50% Heat Added</span>
                  </div>
                  <div className="flex justify-between text-[#9CA3AF]">
                    <span>Cooldown Penalty:</span>
                    <span>5:00 min remaining</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      playClickSound();
                      setRobberyResultModal(null);
                      setIsAdsgramOpen(true);
                    }}
                    type="button"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 text-black font-black text-xs uppercase tracking-wider shadow-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-black" />
                    Watch Ad to Skip Cooldown 🎬
                  </button>
                  <button
                    onClick={() => {
                      playClickSound();
                      setRobberyResultModal(null);
                    }}
                    type="button"
                    className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-[#9CA3AF] cursor-pointer"
                  >
                    Lay Low for Now
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}
      <ToolsShopModal
        isOpen={isToolsShopOpen}
        onClose={() => setIsToolsShopOpen(false)}
        ownedTools={gameState.ownedTools}
        userCoins={gameState.streetCoin}
        onBuyTool={handleBuyTool}
        highlightToolId={highlightTool}
      />

      <AdsgramModal
        isOpen={isAdsgramOpen}
        onClose={() => setIsAdsgramOpen(false)}
        onAdCompleted={handleAdFinished}
      />
    </div>
  );
}
