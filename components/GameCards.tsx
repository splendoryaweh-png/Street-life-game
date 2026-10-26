'use client';

import React from 'react';
import { Gamepad2, Play, Lock, Sparkles, Crosshair, Flag, Bike, Trophy, Flame } from 'lucide-react';
import { playClickSound } from '@/lib/sound';
import { useLanguage } from '@/src/contexts/LanguageContext';

interface GameCardsProps {
  onPlayShooter: () => void;
  onPlayRace: () => void;
  onPlayRider: () => void;
  onComingSoonGame: (title: string) => void;
  isLoading?: boolean;
}

export function GameCardsSkeleton() {
  return (
    <div className="space-y-3">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#FFD700]/30 animate-shimmer" />
          <div className="h-4 w-36 rounded-md bg-white/10 animate-shimmer" />
        </div>
        <div className="h-3 w-20 rounded bg-white/5 animate-shimmer" />
      </div>

      <div className="space-y-2.5">
        {/* 3 Playable Card Skeletons */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-3.5 border-2 border-[#FFD700]/30 shadow-[0_0_15px_rgba(255,215,0,0.1)] bg-[#1a1a1a] relative overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#FFD700]/20 border border-[#FFD700]/30 animate-shimmer shrink-0" />
                <div className="flex flex-col min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-32 rounded bg-white/20 animate-shimmer" />
                    <div className="h-3.5 w-12 rounded bg-[#FFD700]/30 animate-shimmer" />
                  </div>
                  <div className="h-3 w-44 rounded bg-white/10 animate-shimmer" />
                  <div className="h-2.5 w-28 rounded bg-[#FFD700]/20 animate-shimmer" />
                </div>
              </div>
              <div className="w-16 h-8 rounded-xl bg-gradient-to-r from-[#FFD700]/40 to-[#FFC300]/40 animate-shimmer shrink-0" />
            </div>
          </div>
        ))}

        {/* 2 Coming Soon Card Skeletons */}
        {[4, 5].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-3.5 border border-white/10 bg-[#151515] relative overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 animate-shimmer shrink-0" />
                <div className="flex flex-col min-w-0 space-y-1.5">
                  <div className="h-3.5 w-28 rounded bg-white/15 animate-shimmer" />
                  <div className="h-3 w-40 rounded bg-white/5 animate-shimmer" />
                  <div className="h-2.5 w-24 rounded bg-white/5 animate-shimmer" />
                </div>
              </div>
              <div className="w-20 h-7 rounded-xl bg-white/5 border border-white/5 animate-shimmer shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GameCards({
  onPlayShooter,
  onPlayRace,
  onPlayRider,
  onComingSoonGame,
  isLoading = false,
}: GameCardsProps) {
  const { t } = useLanguage();

  if (isLoading) {
    return <GameCardsSkeleton />;
  }

  const games = [
    {
      id: 'galaxy_shooter',
      title: 'Street Galaxy Shooter',
      tagline: '100 levels • 3 enemy types • Dual Gun • Boss bounty',
      icon: Crosshair,
      status: t('play'),
      isPlayable: true,
      rewardHint: '+10/wave • +50 Boss kill',
      borderClass: 'border-2 border-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.18)] bg-gradient-to-b from-[#1c1c1c] to-[#121212]',
      action: onPlayShooter,
    },
    {
      id: 'street_race',
      title: 'Street Race',
      tagline: '3D follow camera • 3 lanes • Car garage & coin grab',
      icon: Flag,
      status: t('play'),
      isPlayable: true,
      rewardHint: '+1 coin/meter + road coins',
      borderClass: 'border-2 border-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.18)] bg-gradient-to-b from-[#1c1c1c] to-[#121212]',
      action: onPlayRace,
    },
    {
      id: 'rider_delivery',
      title: 'Street Rider Delivery',
      tagline: 'Courier mission: 2km delivery in 60s • Bike garage',
      icon: Bike,
      status: t('play'),
      isPlayable: true,
      rewardHint: '+100 coins/delivery',
      borderClass: 'border-2 border-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.18)] bg-gradient-to-b from-[#1c1c1c] to-[#121212]',
      action: onPlayRider,
    },
    {
      id: 'street_boxing',
      title: 'Street Boxing',
      tagline: 'Underground brawls & knockout combos',
      icon: Trophy,
      status: 'COMING_SOON',
      isPlayable: false,
      rewardHint: 'Champion belts & jackpot purses',
      borderClass: 'border border-white/10 bg-[#151515]',
      action: () => onComingSoonGame('Street Boxing'),
    },
    {
      id: 'street_hustle',
      title: 'Street Hustle',
      tagline: 'Passive rackets, businesses & syndicate empire',
      icon: Flame,
      status: 'COMING_SOON',
      isPlayable: false,
      rewardHint: 'Hourly offline revenue streams',
      borderClass: 'border border-white/10 bg-[#151515]',
      action: () => onComingSoonGame('Street Hustle'),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-[#FFD700]" />
          <h2 className="text-sm font-bold text-white tracking-wide">
            Street Games Arena
          </h2>
        </div>
        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full tracking-wider uppercase font-bold">
          3 Games Ready ⚡
        </span>
      </div>

      <div className="space-y-2.5">
        {games.map((game) => {
          const Icon = game.icon;
          return (
            <div
              key={game.id}
              className={`rounded-2xl p-3.5 transition-all relative overflow-hidden ${game.borderClass}`}
            >
              {/* Optional ambient corner flair for playable games */}
              {game.isPlayable && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#FFD700]/10 rounded-full blur-xl pointer-events-none" />
              )}

              <div className="flex items-center justify-between gap-3">
                {/* Game Icon + Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      game.isPlayable
                        ? 'bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/50 shadow-sm shadow-[#FFD700]/20'
                        : 'bg-white/5 text-[#9CA3AF] border border-white/10'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                        {game.title}
                      </h3>
                      {game.isPlayable && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-[#FFD700] text-black">
                          <Sparkles className="w-2.5 h-2.5" />
                          Live
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#9CA3AF] truncate mt-0.5">
                      {game.tagline}
                    </p>
                    <span className="text-[10px] font-mono text-[#FFD700]/90 mt-0.5 font-semibold">
                      {game.rewardHint}
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                <div className="shrink-0 pl-1">
                  {game.isPlayable ? (
                    <button
                      onClick={() => {
                        playClickSound();
                        game.action();
                      }}
                      type="button"
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFC300] text-black font-black text-xs uppercase tracking-wider shadow-md shadow-[#FFD700]/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {t('play')}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        playClickSound();
                        game.action();
                      }}
                      type="button"
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#9CA3AF] font-bold text-[11px] tracking-wide border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Lock className="w-3 h-3 text-[#9CA3AF]" />
                      Coming Soon
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
