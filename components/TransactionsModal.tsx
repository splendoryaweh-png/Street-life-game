'use client';

import React, { useState } from 'react';
import { CoinTransaction } from '@/types/game';
import {
  X,
  Receipt,
  Crosshair,
  Trophy,
  Users,
  Gift,
  Calendar,
  Landmark,
  Bike,
  Flag,
  Coins,
  Sparkles,
  ArrowUpRight,
  Clock,
  Filter,
} from 'lucide-react';
import { playClickSound } from '@/lib/sound';

interface TransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: CoinTransaction[];
  currentBalance: number;
}

export function TransactionsModal({
  isOpen,
  onClose,
  transactions,
  currentBalance,
}: TransactionsModalProps) {
  const [filterType, setFilterType] = useState<'ALL' | 'GAMES' | 'REWARDS' | 'SYNDICATE'>('ALL');

  if (!isOpen) return null;

  // The user requested: "displays a chronological list of the last 10 coin earning events"
  const allEarnings = (transactions || []).filter((tx) => tx.amount > 0);

  const filteredEarnings = allEarnings.filter((tx) => {
    if (filterType === 'GAMES') {
      return ['boss_kill', 'wave_complete', 'race_reward', 'rider_delivery'].includes(tx.type);
    }
    if (filterType === 'REWARDS') {
      return ['daily_reward', 'welcome_bonus', 'ad_reward'].includes(tx.type);
    }
    if (filterType === 'SYNDICATE') {
      return ['referral', 'bank_heist'].includes(tx.type);
    }
    return true;
  });

  // Take the last 10 events
  const last10 = filteredEarnings.slice(0, 10);

  // Sum of last 10 earnings
  const sumLast10 = last10.reduce((acc, tx) => acc + tx.amount, 0);

  const formatRelativeTime = (timestamp: number) => {
    if (!timestamp) return 'Recent';
    try {
      const d = new Date(timestamp);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recent';
    }
  };

  const getEventVisuals = (type: CoinTransaction['type']) => {
    switch (type) {
      case 'boss_kill':
        return {
          icon: Crosshair,
          label: 'Boss Bounty',
          badgeColor: 'text-red-400 bg-red-500/15 border-red-500/30',
          iconBg: 'bg-red-500/20 text-red-400 border-red-500/40',
        };
      case 'wave_complete':
        return {
          icon: Trophy,
          label: 'Wave Defense',
          badgeColor: 'text-[#FFD700] bg-[#FFD700]/15 border-[#FFD700]/30',
          iconBg: 'bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/40',
        };
      case 'race_reward':
        return {
          icon: Flag,
          label: 'Street Race',
          badgeColor: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
          iconBg: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
        };
      case 'rider_delivery':
        return {
          icon: Bike,
          label: 'Courier Delivery',
          badgeColor: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
          iconBg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
        };
      case 'referral':
        return {
          icon: Users,
          label: 'Syndicate Referral',
          badgeColor: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
          iconBg: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
        };
      case 'welcome_bonus':
        return {
          icon: Gift,
          label: 'Welcome Bonus',
          badgeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
          iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        };
      case 'daily_reward':
        return {
          icon: Calendar,
          label: 'Daily Reward',
          badgeColor: 'text-[#FFD700] bg-[#FFD700]/15 border-[#FFD700]/30',
          iconBg: 'bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/40',
        };
      case 'bank_heist':
        return {
          icon: Landmark,
          label: 'Bank Robbery',
          badgeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
          iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        };
      default:
        return {
          icon: Sparkles,
          label: 'Reward',
          badgeColor: 'text-[#FFD700] bg-[#FFD700]/15 border-[#FFD700]/30',
          iconBg: 'bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/40',
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-sm rounded-3xl bg-[#151515] border-2 border-[#FFD700]/40 p-5 shadow-2xl text-left space-y-4 max-h-[90vh] flex flex-col overflow-hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Close Button */}
        <button
          onClick={() => {
            playClickSound();
            onClose();
          }}
          type="button"
          aria-label="Close Transactions"
          className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-[#9CA3AF] hover:text-white transition-colors cursor-pointer active:scale-95 z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pt-1 shrink-0">
          <div className="w-11 h-11 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700]/50 flex items-center justify-center text-[#FFD700] shadow-md shadow-[#FFD700]/20 shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white tracking-tight">
                Coin Transactions
              </h3>
              <span className="px-1.5 py-0.2 rounded-md bg-[#FFD700]/20 text-[#FFD700] text-[10px] font-mono font-bold border border-[#FFD700]/30">
                Last 10
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF]">
              Chronological ledger of recent coin earnings
            </p>
          </div>
        </div>

        {/* Balance & Last 10 Summary Banner */}
        <div className="grid grid-cols-2 gap-2.5 shrink-0">
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-0.5">
            <span className="text-[10px] text-[#9CA3AF] block uppercase tracking-wider font-semibold">
              Current Stash
            </span>
            <div className="flex items-center gap-1.5 text-[#FFD700]">
              <Coins className="w-4 h-4" />
              <span className="text-base font-mono font-black tabular-nums">
                {currentBalance.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[#FFD700]/10 border border-[#FFD700]/30 space-y-0.5">
            <span className="text-[10px] text-[#FFD700] block uppercase tracking-wider font-semibold">
              Last 10 Total
            </span>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <ArrowUpRight className="w-4 h-4" />
              <span className="text-base font-mono font-black tabular-nums">
                +{sumLast10.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 pb-1">
          {(
            [
              { id: 'ALL', label: 'All (10)' },
              { id: 'GAMES', label: 'Games 🎮' },
              { id: 'REWARDS', label: 'Rewards 🎁' },
              { id: 'SYNDICATE', label: 'Syndicate 💼' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                playClickSound();
                setFilterType(tab.id);
              }}
              type="button"
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                filterType === tab.id
                  ? 'bg-[#FFD700] text-black shadow-sm shadow-[#FFD700]/30'
                  : 'bg-white/5 text-[#9CA3AF] hover:text-white border border-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Transactions List (Last 10 Events) */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
          {last10.length === 0 ? (
            <div className="py-8 text-center text-[#9CA3AF] text-xs space-y-1">
              <Clock className="w-8 h-8 text-[#9CA3AF]/40 mx-auto" />
              <p>No transactions found for this filter.</p>
              <p className="text-[10px] text-[#9CA3AF]/60">Play games or claim daily reward to earn coins!</p>
            </div>
          ) : (
            last10.map((tx, idx) => {
              const visuals = getEventVisuals(tx.type);
              const Icon = visuals.icon;

              return (
                <div
                  key={tx.id || idx}
                  className="p-3 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-[#FFD700]/30 transition-all flex items-center justify-between gap-3 group"
                >
                  {/* Left: Icon + Description */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${visuals.iconBg}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate group-hover:text-[#FFD700] transition-colors">
                          {tx.description}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF] mt-0.5">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${visuals.badgeColor}`}
                        >
                          {visuals.label}
                        </span>
                        <span>•</span>
                        <span className="font-mono">{formatRelativeTime(tx.timestamp)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: +Amount Pill */}
                  <div className="shrink-0 text-right">
                    <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-black text-xs tabular-nums shadow-sm shadow-emerald-500/10">
                      +{tx.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info note */}
        <div className="shrink-0 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-[#9CA3AF]/70">
          <span>Synced with streetCoin stash</span>
          <span className="font-mono">Showing {last10.length} events</span>
        </div>
      </div>
    </div>
  );
}
