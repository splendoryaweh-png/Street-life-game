'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, RotateCcw, Volume2, VolumeX, Clock, Trophy, Tv, AlertCircle } from 'lucide-react';
import { playCoinSound, playSuccessSound, playClickSound, playSirenSound } from '@/lib/sound';
import { addGameCoins } from '@/lib/storage';
import { consumeFlipDailyFreeTime, getTodayDailyClaim } from '@/lib/dailyFree';
import confetti from 'canvas-confetti';

interface StreetFlipProps {
  onBack: () => void;
  onToast: (msg: string) => void;
  currentCoins: number;
}

interface CardItem {
  id: string;
  icon: string;
  label: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const BASE_ICONS = [
  { icon: '🏍️', label: 'Bike' },
  { icon: '🏎️', label: 'Car' },
  { icon: '💵', label: 'Money' },
  { icon: '🔫', label: 'Gun' },
  { icon: '🏠', label: 'House' },
  { icon: '👟', label: 'Shoe' },
  { icon: '🧢', label: 'Cap' },
  { icon: '⛓️', label: 'Chain' },
  { icon: '💎', label: 'Diamond' },
  { icon: '🕶️', label: 'Shades' },
];

function generateDeck(lvl: 1 | 2 | 3): CardItem[] {
  const pairCount = lvl === 1 ? 6 : lvl === 2 ? 8 : 10;
  const selected = BASE_ICONS.slice(0, pairCount);
  const deck: CardItem[] = [];

  selected.forEach((item, idx) => {
    deck.push({
      id: `card_${idx}_a`,
      icon: item.icon,
      label: item.label,
      isFlipped: false,
      isMatched: false,
    });
    deck.push({
      id: `card_${idx}_b`,
      icon: item.icon,
      label: item.label,
      isFlipped: false,
      isMatched: false,
    });
  });

  // Shuffle deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

export function StreetFlip({ onBack, onToast }: StreetFlipProps) {
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [cards, setCards] = useState<CardItem[]>(() => generateDeck(1));
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameState, setGameState] = useState<'playing' | 'win' | 'fail'>('playing');
  const [pairsMatched, setPairsMatched] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [adWatching, setAdWatching] = useState(false);
  const [totalEarned, setTotalEarned] = useState(0);

  // Daily Free Time (Prompt 12)
  const [dailyFreeTimeLeft, setDailyFreeTimeLeft] = useState<number>(() => {
    try {
      return getTodayDailyClaim().flip_free_time_remaining;
    } catch {
      return 1;
    }
  });

  const handleApplyDailyFreeTime = () => {
    if (dailyFreeTimeLeft <= 0) {
      onToast('No daily free extra time remaining today!');
      return;
    }
    const res = consumeFlipDailyFreeTime();
    setDailyFreeTimeLeft(res.remaining);
    setTimeLeft((prev) => prev + 15);
    playSfx('click');
    onToast('🃏 +15s Daily Free Extra Time Added!');
  };

  const isLockRef = useRef(false);

  const playSfx = useCallback(
    (type: 'coin' | 'success' | 'click' | 'fail') => {
      if (!soundEnabled) return;
      try {
        if (type === 'coin') playCoinSound();
        else if (type === 'success') playSuccessSound();
        else if (type === 'fail') playSirenSound();
        else playClickSound();
      } catch {}
    },
    [soundEnabled]
  );

  // Initialize Cards for current level (Level 1: 12 cards, Level 2: 16 cards, Level 3: 20 cards)
  const initCards = useCallback((lvl: 1 | 2 | 3) => {
    setLevel(lvl);
    setCards(generateDeck(lvl));
    setFlippedIndices([]);
    setTimeLeft(30);
    setGameState('playing');
    setPairsMatched(0);
    setTotalEarned(0);
    isLockRef.current = false;
  }, []);

  // Win Level
  const handleWin = useCallback(() => {
    setGameState('win');
    const speedBonus = timeLeft > 0 ? 100 : 50;
    setTotalEarned((prev) => prev + speedBonus);
    addGameCoins(speedBonus, `+${speedBonus} SC - Street Flip Speed Bonus!`, 'task_reward');
    playSfx('success');
    onToast(`All pairs matched under time! +${speedBonus} SC Bonus!`);

    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#FFD700', '#FACC15', '#10B981', '#FFFFFF'],
      });
    } catch {}
  }, [onToast, playSfx, timeLeft]);

  // Timer Countdown (30s)
  useEffect(() => {
    if (gameState !== 'playing') return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          setGameState('fail');
          playSfx('fail');
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, playSfx]);

  // Card Flip Action
  const handleCardClick = (idx: number) => {
    if (isLockRef.current || gameState !== 'playing') return;
    if (cards[idx].isFlipped || cards[idx].isMatched) return;

    playClickSound();

    setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, isFlipped: true } : c)));

    const newFlipped = [...flippedIndices, idx];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      isLockRef.current = true;
      const [firstIdx, secondIdx] = newFlipped;

      if (cards[firstIdx].icon === cards[secondIdx].icon) {
        // MATCH!
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) => (i === firstIdx || i === secondIdx ? { ...c, isMatched: true } : c))
          );
          setFlippedIndices([]);
          isLockRef.current = false;

          const matchReward = 10;
          setTotalEarned((prev) => prev + matchReward);
          addGameCoins(matchReward, `+${matchReward} SC - Street Flip Pair Match`, 'task_reward');
          playSfx('coin');
          onToast(`Matched ${cards[firstIdx].label}! +10 SC!`);

          const newMatchCount = pairsMatched + 1;
          setPairsMatched(newMatchCount);

          const targetPairs = level === 1 ? 6 : level === 2 ? 8 : 10;
          if (newMatchCount >= targetPairs) {
            handleWin();
          }
        }, 350);
      } else {
        // NO MATCH -> flip back after 600ms AND remix remaining unmatched cards!
        setTimeout(() => {
          setCards((prev) => {
            // 1. Reset flipped state
            const resetList = prev.map((c, i) =>
              i === firstIdx || i === secondIdx ? { ...c, isFlipped: false } : c
            );

            // 2. Collect all unmatched cards and their indices
            const unmatchedIndices: number[] = [];
            const unmatchedItems: CardItem[] = [];

            resetList.forEach((c, idx) => {
              if (!c.isMatched) {
                unmatchedIndices.push(idx);
                unmatchedItems.push({ ...c, isFlipped: false });
              }
            });

            // 3. Shuffle unmatched cards (Remix)
            for (let i = unmatchedItems.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [unmatchedItems[i], unmatchedItems[j]] = [unmatchedItems[j], unmatchedItems[i]];
            }

            // 4. Place shuffled cards back into unmatched slots
            const remixed = [...resetList];
            unmatchedIndices.forEach((origIdx, sIdx) => {
              remixed[origIdx] = unmatchedItems[sIdx];
            });

            return remixed;
          });

          setFlippedIndices([]);
          isLockRef.current = false;
          playSfx('fail');
          onToast('🔄 Wrong choice! Cards remixed!');
        }, 650);
      }
    }
  };

  // Watch Ad for +15 Sec
  const handleWatchAdTime = () => {
    setAdWatching(true);
    setTimeout(() => {
      setAdWatching(false);
      setTimeLeft((prev) => prev + 15);
      setGameState('playing');
      onToast('+15 Seconds Added! Flip those cards!');
      playSfx('coin');
    }, 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#090A0E] text-white flex flex-col select-none overflow-y-auto overscroll-contain font-sans pb-24"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* TOP HEADER */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#12131A] border-b border-[#FFD700]/30 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              playClickSound();
              onBack();
            }}
            type="button"
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-[#FFD700]" />
          </button>
          <div>
            <h1 className="text-sm font-black uppercase tracking-wider text-[#FFD700] flex items-center gap-1.5">
              <span>STREET FLIP</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/40">
                LEVEL {level}
              </span>
            </h1>
            <p className="text-[10px] text-gray-400">Memory Hustle • 10 SC / Pair • 100 SC Speed Bonus</p>
          </div>
        </div>

        <button
          onClick={() => setSoundEnabled((prev) => !prev)}
          type="button"
          className="p-1.5 rounded-lg bg-white/5 border border-white/10"
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-[#FFD700]" />
          ) : (
            <VolumeX className="w-4 h-4 text-gray-500" />
          )}
        </button>
      </div>

      {/* STATS STRIP */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-black via-[#16161F] to-black border-b border-white/10 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Matched:</span>
          <span className="font-black text-[#FFD700]">
            {pairsMatched} / {level === 1 ? 6 : level === 2 ? 8 : 10} Pairs
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono">
          <Clock className="w-4 h-4 text-orange-400" />
          <span
            className={`font-black text-sm ${
              timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-white'
            }`}
          >
            {timeLeft}s
          </span>
          {dailyFreeTimeLeft > 0 && (
            <button
              onClick={handleApplyDailyFreeTime}
              type="button"
              className="ml-1 px-1.5 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[8px] font-black uppercase active:scale-95 transition-all shadow-[0_0_8px_rgba(6,182,212,0.3)] cursor-pointer"
            >
              +15s Free (1/1)
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs font-bold text-emerald-400">
          <span>🪙</span>
          <span>+{totalEarned} SC</span>
        </div>
      </div>

      {/* CARDS GRID */}
      <div className="flex-1 flex items-center justify-center p-3">
        <div
          className={`grid gap-2.5 max-w-sm w-full mx-auto ${
            level === 1 ? 'grid-cols-3' : level === 2 ? 'grid-cols-4' : 'grid-cols-4'
          }`}
        >
          {cards.map((card, idx) => (
            <button
              key={card.id}
              onClick={() => handleCardClick(idx)}
              type="button"
              className={`aspect-[3/4] rounded-2xl border-2 transition-all duration-300 flex items-center justify-center select-none cursor-pointer ${
                card.isFlipped || card.isMatched
                  ? 'bg-gradient-to-tr from-[#252838] to-[#12131C] border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.3)]'
                  : 'bg-black border-yellow-500/40 hover:border-yellow-400 shadow-md active:scale-95'
              } ${card.isMatched ? 'opacity-70 scale-95' : ''}`}
            >
              {card.isFlipped || card.isMatched ? (
                <div className="flex flex-col items-center animate-in zoom-in-75">
                  <span className="text-3xl">{card.icon}</span>
                  <span className="text-[9px] font-bold text-gray-300 mt-1 uppercase tracking-tight">
                    {card.label}
                  </span>
                </div>
              ) : (
                /* Card Back: Sleek Black with Yellow Street Life Logo */
                <div className="flex flex-col items-center justify-center w-full h-full p-2">
                  <div className="w-8 h-8 rounded-full bg-yellow-400/20 border border-yellow-400/60 flex items-center justify-center text-xs font-black text-yellow-300 shadow-sm">
                    SL
                  </div>
                  <span className="text-[8px] font-black uppercase text-yellow-500/80 mt-1">
                    HUSTLE
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* WIN POPUP */}
      {gameState === 'win' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#181B26] via-[#11131C] to-[#0A0B10] border-2 border-[#FFD700] p-6 text-center shadow-[0_0_40px_rgba(255,215,0,0.4)]">
            <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700] flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(255,215,0,0.3)]">
              <Trophy className="w-9 h-9 text-[#FFD700]" />
            </div>

            <h3 className="text-2xl font-black italic uppercase text-white tracking-tight">
              ALL PAIRS MATCHED!
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Sharp memory on the street! Speed Bonus awarded.
            </p>

            <div className="my-4 py-3 px-4 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-between">
              <span className="text-xs text-gray-400">Total Coins:</span>
              <span className="text-xl font-black text-[#FFD700]">🪙 +{totalEarned} SC</span>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => {
                  playClickSound();
                  initCards(level < 3 ? ((level + 1) as 1 | 2 | 3) : 1);
                }}
                type="button"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.5)] active:scale-95 transition-all cursor-pointer"
              >
                {level < 3 ? `NEXT LEVEL ${level + 1}` : 'PLAY AGAIN'}
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  onBack();
                }}
                type="button"
                className="w-full py-2.5 text-xs text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                Home Base
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAIL / TIME OUT POPUP */}
      {gameState === 'fail' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#211414] via-[#160D0D] to-[#0A0707] border-2 border-red-500/50 p-6 text-center shadow-[0_0_40px_rgba(239,68,68,0.3)]">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-9 h-9 text-red-400" />
            </div>

            <h3 className="text-2xl font-black italic uppercase text-white tracking-tight">TIME&apos;S UP!</h3>
            <p className="text-xs text-gray-400 mt-1">You ran out of time before matching all cards.</p>

            <div className="flex flex-col gap-2.5 mt-5">
              <button
                onClick={handleWatchAdTime}
                disabled={adWatching}
                type="button"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.5)] active:scale-95 transition-all cursor-pointer"
              >
                <Tv className="w-4 h-4 fill-black" />
                {adWatching ? 'Watching Ad...' : 'Watch Ad for +15 Sec'}
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  initCards(level);
                }}
                type="button"
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Retry Level
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  onBack();
                }}
                type="button"
                className="w-full py-2.5 text-xs text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                Home Base
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
