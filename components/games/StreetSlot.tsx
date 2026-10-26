'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Volume2, VolumeX, Sparkles, Coins, Trophy, Zap, Gift, Tv, CheckCircle2, X } from 'lucide-react';
import { playCoinSound, playSuccessSound, playClickSound, playSirenSound } from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';
import { consumeSlotDailyFreeSpin, getTodayDailyClaim } from '@/lib/dailyFree';
import confetti from 'canvas-confetti';

interface StreetSlotProps {
  onBack: () => void;
  onToast: (msg: string) => void;
  currentCoins: number;
}

type SlotIconType = 'shoe' | 'cap' | 'chain' | 'car' | 'house' | 'dollar';

interface SlotSymbol {
  type: SlotIconType;
  emoji: string;
  label: string;
  payout3: number;
}

const SYMBOLS: SlotSymbol[] = [
  { type: 'shoe', emoji: '👟', label: 'Shoe', payout3: 50 },
  { type: 'cap', emoji: '🧢', label: 'Cap', payout3: 100 },
  { type: 'chain', emoji: '⛓️', label: 'Chain', payout3: 150 },
  { type: 'car', emoji: '🏎️', label: 'Car', payout3: 300 },
  { type: 'house', emoji: '🏠', label: 'House', payout3: 1000 },
  { type: 'dollar', emoji: '💵', label: 'Dollar', payout3: 500 },
];

const SPIN_COST = 20;

export function StreetSlot({ onBack, onToast, currentCoins }: StreetSlotProps) {
  const [reels, setReels] = useState<[SlotSymbol, SlotSymbol, SlotSymbol]>([
    SYMBOLS[0],
    SYMBOLS[1],
    SYMBOLS[2],
  ]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Daily Free Spins: strictly max 1 spin
  const [freeSpinsToday, setFreeSpinsToday] = useState<number>(() => {
    try {
      return Math.min(1, getTodayDailyClaim().slot_free_spins_remaining);
    } catch {
      return 1;
    }
  });

  // 2 Cards Pop-out states after 1 spin is used
  const [showCardsModal, setShowCardsModal] = useState<boolean>(false);
  const [adsWatchedCount, setAdsWatchedCount] = useState<number>(0);
  const [isWatchingAd, setIsWatchingAd] = useState<boolean>(false);
  const [adCountdown, setAdCountdown] = useState<number>(3);

  const playSfx = useCallback(
    (type: 'coin' | 'success' | 'click' | 'jackpot') => {
      if (!soundEnabled) return;
      try {
        if (type === 'coin') playCoinSound();
        else if (type === 'jackpot' || type === 'success') playSuccessSound();
        else playClickSound();
      } catch {}
    },
    [soundEnabled]
  );

  // Spin Reels logic
  const handleSpin = () => {
    if (isSpinning) return;

    // Check if free spin available (Max 1 daily)
    if (freeSpinsToday <= 0) {
      // Free spin used -> show the 2 cards to choose from
      setShowCardsModal(true);
      playClickSound();
      return;
    }

    // Consume 1 daily free spin
    const res = consumeSlotDailyFreeSpin();
    setFreeSpinsToday(0);
    onToast(`🎰 1 Daily Free Spin Used!`);

    setIsSpinning(true);
    setLastWin(null);
    playClickSound();

    let spins = 0;
    const spinInterval = setInterval(() => {
      setReels([
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      ]);
      spins++;

      if (spins > 16) {
        clearInterval(spinInterval);

        // Final result evaluation with weighted probabilities
        const rand = Math.random();
        let r1: SlotSymbol;
        let r2: SlotSymbol;
        let r3: SlotSymbol;

        if (rand < 0.03) {
          r1 = SYMBOLS[4];
          r2 = SYMBOLS[4];
          r3 = SYMBOLS[4];
        } else if (rand < 0.08) {
          r1 = SYMBOLS[3];
          r2 = SYMBOLS[3];
          r3 = SYMBOLS[3];
        } else if (rand < 0.15) {
          r1 = SYMBOLS[2];
          r2 = SYMBOLS[2];
          r3 = SYMBOLS[2];
        } else if (rand < 0.28) {
          r1 = SYMBOLS[1];
          r2 = SYMBOLS[1];
          r3 = SYMBOLS[1];
        } else if (rand < 0.45) {
          r1 = SYMBOLS[0];
          r2 = SYMBOLS[0];
          r3 = SYMBOLS[0];
        } else {
          r1 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          r2 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          r3 = SYMBOLS[(SYMBOLS.indexOf(r1) + 1) % SYMBOLS.length];
        }

        setReels([r1, r2, r3]);
        setIsSpinning(false);

        // Check 3 matching
        if (r1.type === r2.type && r2.type === r3.type) {
          const payout = r1.payout3;
          setLastWin(payout);
          addGameCoins(payout, `+${payout} SC - Street Slot 3x ${r1.label} Win!`, 'task_reward');
          playSfx(payout >= 500 ? 'jackpot' : 'coin');
          onToast(`🎉 JACKPOT MATCH! 3x ${r1.label} won +${payout} Street Coins!`);

          try {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#FFD700', '#FACC15', '#FFFFFF'],
            });
          } catch {}
        } else {
          setLastWin(0);
          playClickSound();
        }

        // After this 1 spin, trigger the 2 cards pop-out immediately
        setTimeout(() => {
          setShowCardsModal(true);
        }, 1200);
      }
    }, 70);
  };

  // Card Option 1: Watch 3 Ads to get 1 more spin
  const handleWatchAdForSpin = () => {
    if (isWatchingAd) return;
    setIsWatchingAd(true);
    setAdCountdown(3);
    playClickSound();

    const timer = setInterval(() => {
      setAdCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsWatchingAd(false);
          const nextCount = adsWatchedCount + 1;
          setAdsWatchedCount(nextCount);

          if (nextCount >= 3) {
            setAdsWatchedCount(0);
            setFreeSpinsToday(1);
            setShowCardsModal(false);
            playSuccessSound();
            onToast('🎉 3 Ads Watched! +1 Spin Awarded!');
            try {
              confetti({ particleCount: 50, spread: 60, origin: { y: 0.5 } });
            } catch {}
          } else {
            playCoinSound();
            onToast(`📺 Ad ${nextCount}/3 watched! Watch ${3 - nextCount} more for 1 spin.`);
          }
          return 3;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Card Option 2: Spend 5,000 SC to get 1 spin
  const handleSpendCoinsForSpin = () => {
    playClickSound();
    if (currentCoins < 5000) {
      onToast(`Insufficient funds! Need 5,000 SC (You have ${currentCoins.toLocaleString()} SC).`);
      return;
    }

    addGameCoins(-5000, '-5,000 SC - Bought 1 Slot Spin', 'task_reward');
    setFreeSpinsToday(1);
    setShowCardsModal(false);
    playSuccessSound();
    onToast('🎰 5,000 SC spent! +1 Spin Ready!');
  };


  return (
    <div
      className="fixed inset-0 z-50 bg-[#090A0E] text-white flex flex-col select-none overflow-y-auto overscroll-contain pb-24 font-sans"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* TOP HEADER */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#12131A] border-b border-[#FFD700]/30 shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              playClickSound();
              onBack();
            }}
            type="button"
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-[#FFD700]" />
          </button>
          <div>
            <h1 className="text-sm font-black uppercase tracking-wider text-[#FFD700] flex items-center gap-1.5">
              <span>STREET SLOT</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/40">
                1000 SC JACKPOT
              </span>
            </h1>
            <p className="text-[10px] text-gray-400">3 Reels • Daily Max 1 Free Spin • Extra Spins via Ads or SC</p>
          </div>
        </div>

        <button
          onClick={() => setSoundEnabled((prev) => !prev)}
          type="button"
          className="p-1.5 rounded-lg bg-white/5 border border-white/10 cursor-pointer"
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-[#FFD700]" />
          ) : (
            <VolumeX className="w-4 h-4 text-gray-500" />
          )}
        </button>
      </div>

      {/* CASINO SLOT MACHINE BODY */}
      <div className="flex-1 flex flex-col items-center justify-start p-4 max-w-sm mx-auto w-full">
        {/* Machine Frame */}
        <div className="w-full rounded-3xl bg-gradient-to-b from-[#1E1F2A] via-[#12131C] to-[#0A0B10] border-4 border-[#FFD700] p-5 shadow-[0_0_40px_rgba(255,215,0,0.35)] flex flex-col items-center mt-2">
          {/* Top Marquee */}
          <div className="flex items-center justify-between w-full px-3 py-1.5 rounded-xl bg-black/80 border border-[#FFD700]/40 mb-4">
            <span className="text-[11px] font-black uppercase text-[#FFD700] tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 fill-current" /> STREET JACKPOT
            </span>
            <span className="text-xs font-mono font-black text-white">🪙 1,000 SC</span>
          </div>

          {/* 3 REELS DISPLAY */}
          <div className="grid grid-cols-3 gap-2.5 w-full bg-black/90 p-3 rounded-2xl border-2 border-white/15 mb-4 shadow-inner">
            {reels.map((sym, idx) => (
              <div
                key={idx}
                className={`h-28 rounded-xl bg-gradient-to-b from-[#222432] via-[#151620] to-[#0D0E16] border border-white/20 flex flex-col items-center justify-center shadow-lg transition-transform ${
                  isSpinning ? 'animate-pulse scale-95 blur-[0.5px]' : 'scale-100'
                }`}
              >
                <span className="text-4xl drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">{sym.emoji}</span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-300 mt-1">
                  {sym.label}
                </span>
              </div>
            ))}
          </div>

          {/* LAST WIN DISPLAY */}
          <div className="h-9 flex items-center justify-center w-full mb-3">
            {lastWin !== null && (
              <div className="px-4 py-1.5 rounded-full bg-yellow-400/20 border border-yellow-400 text-xs font-black text-yellow-300 animate-bounce">
                {lastWin > 0 ? `🎉 WINNER! +${lastWin} SC Credited!` : 'No match, try another spin!'}
              </div>
            )}
          </div>

          {/* BIG YELLOW SPIN BUTTON */}
          <button
            onClick={handleSpin}
            disabled={isSpinning}
            type="button"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 text-black font-black text-base uppercase tracking-wider shadow-[0_0_30px_rgba(250,204,21,0.8)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50"
          >
            <Zap className="w-5 h-5 fill-black" />
            <span>
              {isSpinning
                ? 'SPINNING...'
                : freeSpinsToday > 0
                ? '1 DAILY FREE SPIN (READY)'
                : 'GET MORE SPINS 🔓'}
            </span>
          </button>
        </div>

        {/* 2 POP-OUT CARDS (Watch 3 Ads / Spend 5,000 SC) */}
        {showCardsModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-3xl bg-[#13141F] border-2 border-[#FFD700] p-5 shadow-[0_0_35px_rgba(255,215,0,0.35)] space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#FFD700]" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Daily Free Spin Completed!
                  </h3>
                </div>
                <button
                  onClick={() => setShowCardsModal(false)}
                  type="button"
                  className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-gray-300 text-center font-medium">
                Choose an option below to get 1 more spin:
              </p>

              {/* CARD 1: WATCH 3 ADS TO GET 1 MORE SPIN */}
              <div
                onClick={handleWatchAdForSpin}
                className="p-4 rounded-2xl bg-gradient-to-br from-[#1E192E] to-[#120E1E] border-2 border-purple-500/60 hover:border-purple-400 transition-all cursor-pointer active:scale-98 shadow-lg group relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400 flex items-center justify-center text-purple-300">
                      <Tv className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider group-hover:text-purple-300 transition-colors">
                        Watch 3 Ads
                      </h4>
                      <p className="text-[10px] text-purple-200">Get 1 More Spin Free</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-300 text-[10px] font-mono font-bold border border-purple-400/40">
                    {adsWatchedCount}/3 Ads
                  </span>
                </div>

                <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden mb-2">
                  <div
                    className="bg-purple-400 h-full transition-all duration-300"
                    style={{ width: `${(adsWatchedCount / 3) * 100}%` }}
                  />
                </div>

                <button
                  disabled={isWatchingAd}
                  type="button"
                  className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  {isWatchingAd ? (
                    <span>Watching Ad... ({adCountdown}s)</span>
                  ) : (
                    <>
                      <Tv className="w-3.5 h-3.5" />
                      <span>{adsWatchedCount === 0 ? 'Watch 3 Ads (Click to Start)' : `Watch Ad ${adsWatchedCount + 1}/3`}</span>
                    </>
                  )}
                </button>
              </div>

              {/* CARD 2: SPEND 5,000 SC TO GET 1 SPIN */}
              <div
                onClick={handleSpendCoinsForSpin}
                className="p-4 rounded-2xl bg-gradient-to-br from-[#241F10] to-[#141208] border-2 border-[#FFD700]/60 hover:border-[#FFD700] transition-all cursor-pointer active:scale-98 shadow-lg group relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-[#FFD700]/20 border border-[#FFD700] flex items-center justify-center text-[#FFD700]">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider group-hover:text-[#FFD700] transition-colors">
                        Spend 5,000 SC
                      </h4>
                      <p className="text-[10px] text-[#FFD700]/80">Instant 1 Spin</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#FFD700]/20 text-[#FFD700] text-[10px] font-mono font-black border border-[#FFD700]/40">
                    5,000 SC
                  </span>
                </div>

                <p className="text-[10px] text-gray-400 mb-2">
                  Your Balance: <span className="font-mono font-bold text-white">{currentCoins.toLocaleString()} SC</span>
                </p>

                <button
                  type="button"
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Spend 5,000 SC for 1 Spin</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PAYTABLE ACCORDION / STRIP */}
        <div className="w-full mt-4 p-3 rounded-2xl bg-black/60 border border-white/10 text-[10px] text-gray-400">
          <div className="text-[11px] font-black uppercase text-[#FFD700] mb-2 tracking-wide">
            Payout Table (3 of a kind):
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex justify-between">
              <span>🏠 3 Houses:</span> <span className="font-bold text-[#FFD700]">1000 SC</span>
            </div>
            <div className="flex justify-between">
              <span>💵 3 Dollars:</span> <span className="font-bold text-[#FFD700]">500 SC</span>
            </div>
            <div className="flex justify-between">
              <span>🏎️ 3 Cars:</span> <span className="font-bold text-white">300 SC</span>
            </div>
            <div className="flex justify-between">
              <span>⛓️ 3 Chains:</span> <span className="font-bold text-white">150 SC</span>
            </div>
            <div className="flex justify-between">
              <span>🧢 3 Caps:</span> <span className="font-bold text-white">100 SC</span>
            </div>
            <div className="flex justify-between">
              <span>👟 3 Shoes:</span> <span className="font-bold text-white">50 SC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
