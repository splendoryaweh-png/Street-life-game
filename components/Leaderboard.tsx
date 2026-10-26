'use client';

import React from 'react';
import { LeaderboardEntry } from '@/types/game';
import { Trophy, Flame, Crown, Medal } from 'lucide-react';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  userCoins: number;
  userName?: string;
  isLoading?: boolean;
}

/**
 * Premium Dark Luxury Shimmer Placeholder for User Profile Avatars
 */
export function AvatarShimmerPlaceholder({
  isTop1 = false,
  isTop2 = false,
  isTop3 = false,
  isUser = false,
}: {
  isTop1?: boolean;
  isTop2?: boolean;
  isTop3?: boolean;
  isUser?: boolean;
}) {
  const isTopThree = isTop1 || isTop2 || isTop3;

  return (
    <div
      className={`w-7 h-7 rounded-full overflow-hidden shrink-0 relative animate-shimmer ${
        isUser
          ? 'bg-gradient-to-tr from-[#FFD700]/30 via-[#1c1c1c] to-[#FFC300]/20 border-2 border-[#FFD700] shadow-[0_0_12px_rgba(255,215,0,0.35)]'
          : isTop1
          ? 'bg-gradient-to-tr from-[#FFD700]/25 via-[#1c1c1c] to-[#FFD700]/10 border border-[#FFD700]/60 shadow-[0_0_10px_rgba(255,215,0,0.25)]'
          : isTop2
          ? 'bg-gradient-to-tr from-[#FFC300]/20 via-[#1c1c1c] to-white/5 border border-[#FFC300]/40 shadow-sm'
          : isTop3
          ? 'bg-gradient-to-tr from-amber-500/20 via-[#1c1c1c] to-white/5 border border-amber-500/40 shadow-sm'
          : 'bg-white/5 border border-white/10'
      }`}
      aria-label="Loading avatar"
    >
      {/* Subtle inner silhouette or pulse center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`w-3 h-3 rounded-full ${
            isUser || isTopThree ? 'bg-[#FFD700]/20' : 'bg-white/10'
          }`}
        />
      </div>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#151515] p-4 shadow-xl flex flex-col">
      {/* Title + Badge Skeleton */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#FFD700]/30 animate-shimmer" />
          <div className="h-4 w-28 rounded-md bg-white/10 animate-shimmer" />
        </div>
        <div className="h-4 w-14 rounded-full bg-[#FFD700]/15 animate-shimmer" />
      </div>

      {/* Row Skeletons (8 items) with Shimmer Avatars */}
      <div className="space-y-1.5 overflow-hidden">
        {/* Top 1 Skeleton (Gold Accent) */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-[#FFD700]/15 via-[#FFD700]/5 to-transparent border border-[#FFD700]/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-5 h-4 rounded bg-[#FFD700]/40 animate-shimmer" />
            <AvatarShimmerPlaceholder isTop1 />
            <div className="h-3.5 w-28 rounded bg-white/20 animate-shimmer" />
          </div>
          <div className="h-3.5 w-16 rounded bg-[#FFD700]/30 animate-shimmer" />
        </div>

        {/* Top 2 Skeleton */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-[#FFC300]/10 via-white/5 to-transparent border border-[#FFC300]/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-5 h-4 rounded bg-zinc-400/30 animate-shimmer" />
            <AvatarShimmerPlaceholder isTop2 />
            <div className="h-3.5 w-24 rounded bg-white/15 animate-shimmer" />
          </div>
          <div className="h-3.5 w-16 rounded bg-white/15 animate-shimmer" />
        </div>

        {/* Top 3 Skeleton */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/10 via-white/5 to-transparent border border-amber-500/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-5 h-4 rounded bg-amber-600/30 animate-shimmer" />
            <AvatarShimmerPlaceholder isTop3 />
            <div className="h-3.5 w-26 rounded bg-white/15 animate-shimmer" />
          </div>
          <div className="h-3.5 w-16 rounded bg-white/15 animate-shimmer" />
        </div>

        {/* Rows 4 to 8 (Neutral Skeletons) */}
        {[4, 5, 6, 7, 8].map((index) => (
          <div
            key={index}
            className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-5 h-3 rounded bg-white/5 animate-shimmer" />
              <AvatarShimmerPlaceholder />
              <div
                className="h-3.5 rounded bg-white/10 animate-shimmer"
                style={{ width: `${60 + (index * 13) % 40}px` }}
              />
            </div>
            <div className="h-3.5 w-14 rounded bg-white/10 animate-shimmer" />
          </div>
        ))}
      </div>

      {/* Sticky User Card Skeleton with Shimmer Avatar */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="rounded-xl bg-gradient-to-r from-[#FFD700]/10 via-[#1a1a1a] to-[#FFD700]/5 border-2 border-[#FFD700]/40 p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <AvatarShimmerPlaceholder isUser />
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="h-3.5 w-16 rounded bg-white/20 animate-shimmer" />
                <div className="h-3 w-12 rounded bg-[#FFD700]/25 animate-shimmer" />
              </div>
              <div className="h-2.5 w-24 rounded bg-white/10 animate-shimmer" />
            </div>
          </div>
          <div className="h-4 w-18 rounded bg-[#FFD700]/30 animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

export function Leaderboard({
  entries,
  userCoins,
  userName = 'You',
  isLoading = false,
}: LeaderboardProps) {
  // If entries are not ready yet, render the full skeleton
  if (!entries || entries.length === 0) {
    return <LeaderboardSkeleton />;
  }

  // Top 10 list
  const top10 = entries.slice(0, 10);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#151515] p-4 shadow-xl flex flex-col">
      {/* Title + Weekly Badge */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#FFD700]" />
          <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
            Top Hustlers <Flame className="w-4 h-4 text-orange-500 fill-orange-500 inline" />
          </h2>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 text-[10px] font-bold text-[#FFD700] uppercase tracking-wider">
          Weekly
        </div>
      </div>

      {/* Top 10 Hustlers List */}
      <div className="space-y-1.5 overflow-hidden">
        {top10.map((player) => {
          const isTop1 = player.rank === 1;
          const isTop2 = player.rank === 2;
          const isTop3 = player.rank === 3;
          const isTopThree = isTop1 || isTop2 || isTop3;

          return (
            <div
              key={player.id}
              className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                isTop1
                  ? 'bg-gradient-to-r from-[#FFD700]/20 via-[#FFD700]/10 to-transparent border border-[#FFD700]/50 shadow-sm shadow-[#FFD700]/10'
                  : isTop2
                  ? 'bg-gradient-to-r from-[#FFC300]/15 via-white/5 to-transparent border border-[#FFC300]/30'
                  : isTop3
                  ? 'bg-gradient-to-r from-amber-500/15 via-white/5 to-transparent border border-amber-500/30'
                  : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.05]'
              }`}
            >
              {/* Rank + Avatar + Name */}
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Rank number or medal */}
                <div className="w-6 text-center shrink-0">
                  {isTop1 ? (
                    <Crown className="w-4 h-4 text-[#FFD700] mx-auto fill-[#FFD700]" />
                  ) : isTop2 ? (
                    <Medal className="w-4 h-4 text-zinc-300 mx-auto" />
                  ) : isTop3 ? (
                    <Medal className="w-4 h-4 text-amber-600 mx-auto" />
                  ) : (
                    <span className="text-xs font-mono font-bold text-[#9CA3AF]">
                      #{player.rank}
                    </span>
                  )}
                </div>

                {/* Avatar Icon or Shimmer Placeholder */}
                {isLoading ? (
                  <AvatarShimmerPlaceholder
                    isTop1={isTop1}
                    isTop2={isTop2}
                    isTop3={isTop3}
                  />
                ) : (
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 transition-transform duration-200 ${
                      isTopThree
                        ? 'bg-[#FFD700]/20 border border-[#FFD700]/40'
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    {player.avatar}
                  </div>
                )}

                {/* Player Name */}
                <span
                  className={`text-xs font-semibold truncate ${
                    isTopThree ? 'text-white font-bold' : 'text-white/90'
                  }`}
                >
                  {player.name}
                </span>
              </div>

              {/* Coins */}
              <div className="text-right shrink-0 pl-2">
                <span
                  className={`text-xs font-mono font-bold tabular-nums ${
                    isTopThree ? 'text-[#FFD700]' : 'text-white/80'
                  }`}
                >
                  {player.coins.toLocaleString()}
                </span>
                <span className="text-[10px] text-[#9CA3AF] ml-1">
                  coins
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky User Card at Bottom of Leaderboard */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#FFD700]/15 via-[#1a1a1a] to-[#FFD700]/10 border-2 border-[#FFD700] p-2.5 shadow-lg shadow-[#FFD700]/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* User Avatar: Shimmer Placeholder while isLoading */}
            {isLoading ? (
              <AvatarShimmerPlaceholder isUser />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#FFD700] text-black font-black text-xs flex items-center justify-center shrink-0 shadow-sm shadow-[#FFD700]/50">
                YOU
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white truncate">
                  {userName}
                </span>
                <span className="text-[10px] font-mono font-bold text-[#FFD700] bg-[#FFD700]/15 px-1.5 py-0.2 rounded border border-[#FFD700]/30">
                  Rank #342
                </span>
              </div>
              <span className="text-[10px] text-[#9CA3AF]">
                Hustle to break Top 100!
              </span>
            </div>
          </div>

          <div className="text-right shrink-0 pl-2">
            <span className="text-sm font-mono font-extrabold text-[#FFD700] tabular-nums">
              {userCoins.toLocaleString()}
            </span>
            <span className="text-[10px] text-[#9CA3AF] ml-1">
              coins
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
