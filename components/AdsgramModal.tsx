'use client';

import React, { useState, useEffect } from 'react';
import { Tv, Sparkles, CheckCircle2, Play, X } from 'lucide-react';

interface AdsgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdCompleted: () => void;
}

function AdsgramModalContent({
  onClose,
  onAdCompleted,
}: {
  onClose: () => void;
  onAdCompleted: () => void;
}) {
  const [countdown, setCountdown] = useState(3);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleClaim = () => {
    onAdCompleted();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#151515] border-2 border-emerald-500/50 p-6 shadow-2xl text-center space-y-4">
        {isFinished && (
          <button
            onClick={onClose}
            type="button"
            aria-label="Close Ad"
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-[#9CA3AF] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Sponsor Banner */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
          <Tv className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
            Adsgram Sponsor Video
          </div>
          <h3 className="text-base font-black text-white tracking-tight">
            Underground Syndicate Telecom
          </h3>
          <p className="text-xs text-[#9CA3AF]">
            Watching sponsor broadcast to wipe police record...
          </p>
        </div>

        {/* Video simulation box */}
        <div className="w-full h-32 rounded-2xl bg-black/60 border border-white/10 flex flex-col items-center justify-center relative overflow-hidden p-4">
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 via-transparent to-amber-500/10" />

          {!isFinished ? (
            <div className="relative z-10 flex flex-col items-center space-y-2">
              <div className="w-10 h-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin flex items-center justify-center">
                <Play className="w-4 h-4 text-emerald-400 fill-emerald-400 ml-0.5" />
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">
                Reward in {countdown}s...
              </span>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center space-y-1 text-emerald-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-bounce" />
              <span className="text-xs font-bold text-white">Sponsor Broadcast Finished!</span>
              <span className="text-[10px] text-[#9CA3AF]">Police trace scrambled.</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div>
          {isFinished ? (
            <button
              onClick={handleClaim}
              type="button"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-black" />
              Skip Cooldown & Clear Record
            </button>
          ) : (
            <div className="py-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-[#9CA3AF] font-mono">
              Reward ready in {countdown} seconds
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdsgramModal({ isOpen, onClose, onAdCompleted }: AdsgramModalProps) {
  if (!isOpen) return null;
  return <AdsgramModalContent onClose={onClose} onAdCompleted={onAdCompleted} />;
}
