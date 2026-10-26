'use client';

import React from 'react';
import { Sparkles, TrendingUp, ReceiptText, BookOpen } from 'lucide-react';
import { playClickSound } from '@/lib/sound';

interface HeroBalanceCardProps {
  streetCoin: number;
  onOpenTransactions?: () => void;
  onOpenNovel?: () => void;
}

export function HeroBalanceCard({
  streetCoin,
  onOpenTransactions,
  onOpenNovel,
}: HeroBalanceCardProps) {
  // Conversions based on 100,000 Coin = $1.00
  const usdValue = (streetCoin / 100000).toFixed(2);
  // Using the game's exact calibrated ratio (12,450 = 0.122 TON)
  const tonValue = ((streetCoin / 12450) * 0.122).toFixed(3);

  return (
    <div className="relative rounded-2xl border border-white/10 bg-[#151515] p-5 shadow-xl overflow-hidden text-center">
      {/* Background radial gold sheen */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-[#FFD700]/5 blur-2xl pointer-events-none rounded-full" />
      
      {/* Mini top badge */}
      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-[#FFD700] mb-2">
        <Sparkles className="w-3 h-3 text-[#FFD700]" />
        <span>Total Net Worth</span>
      </div>

      {/* Main Street Coin Balance (Large Gold) */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF099] via-[#FFD700] to-[#FFC300] tracking-tight tabular-nums drop-shadow-[0_2px_10px_rgba(255,215,0,0.3)]">
          {streetCoin.toLocaleString()}
        </span>
        <span className="text-sm font-bold text-[#FFD700] tracking-wide uppercase">
          Street Coin
        </span>
      </div>

      {/* Secondary conversion values */}
      <div className="mt-1.5 text-xs text-[#9CA3AF] font-medium flex items-center justify-center gap-1.5 tabular-nums">
        <TrendingUp className="w-3 h-3 text-emerald-400" />
        <span>= ${usdValue}</span>
        <span className="text-white/20">|</span>
        <span>= {tonValue} TON</span>
      </div>

      {/* Tiny conversion rate rule */}
      <div className="mt-2 text-[10px] text-[#9CA3AF]/70 font-mono tracking-wider">
        100,000 Coin = $1
      </div>

      {/* Transactions History CTA Button & Street Novel Button */}
      {(onOpenTransactions || onOpenNovel) && (
        <div className="mt-3.5 pt-3 border-t border-white/5 flex flex-col items-center justify-center">
          {onOpenTransactions && (
            <button
              onClick={() => {
                playClickSound();
                onOpenTransactions();
              }}
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FFD700]/10 hover:bg-[#FFD700]/20 text-[#FFD700] text-xs font-bold border border-[#FFD700]/30 transition-all cursor-pointer active:scale-95 shadow-sm shadow-[#FFD700]/10"
            >
              <ReceiptText className="w-3.5 h-3.5" />
              <span>Coin Transactions (Last 10)</span>
            </button>
          )}

          {/* Street Novel button - on its own line, below Coin Transactions with mt-3 */}
          {onOpenNovel && (
            <button
              onClick={() => {
                playClickSound();
                onOpenNovel();
              }}
              type="button"
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-black hover:bg-[#1a1a1a] text-[#FFD700] text-xs font-bold border border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.35)] hover:shadow-[0_0_20px_rgba(255,215,0,0.55)] transition-all cursor-pointer active:scale-95"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#FFD700]" />
              <span>📖 Street Novel</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
