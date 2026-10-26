'use client';

import React from 'react';
import { X, Crosshair, Play, Sparkles, Check } from 'lucide-react';

interface ShooterPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateRun: () => void;
  hasPlayedToday: boolean;
}

export function ShooterPreviewModal({
  isOpen,
  onClose,
  onSimulateRun,
  hasPlayedToday,
}: ShooterPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#151515] border-2 border-[#FFD700] p-6 shadow-2xl text-center space-y-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          aria-label="Close Preview"
          className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-[#9CA3AF] hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Game Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700] flex items-center justify-center text-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.3)]">
          <Crosshair className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-black text-white tracking-tight">
            Street Galaxy Shooter
          </h3>
          <p className="text-xs text-[#FFD700] font-semibold">
            Full Gameplay Arriving in Prom 2!
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 text-xs text-[#9CA3AF] text-left space-y-2">
          <div className="flex items-center gap-2 text-white font-bold">
            <Sparkles className="w-4 h-4 text-[#FFD700]" />
            <span>Interactive Retro Arcade Shooter</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            In Prom 2, command a custom starship, shoot down syndicate alien convoys, and collect real coin multipliers.
          </p>
        </div>

        {/* Action Button */}
        <div className="space-y-2 pt-1">
          {!hasPlayedToday ? (
            <button
              onClick={() => {
                onSimulateRun();
                onClose();
              }}
              type="button"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFC300] text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-[#FFD700]/25 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Simulate 1 Game Run Now (Unlock Daily)
            </button>
          ) : (
            <div className="py-2.5 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5">
              <Check className="w-4 h-4" />
              <span>You played a game today! Daily Reward is unlocked.</span>
            </div>
          )}

          <button
            onClick={onClose}
            type="button"
            className="w-full py-2.5 rounded-xl bg-white/5 text-xs text-[#9CA3AF] hover:text-white transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
