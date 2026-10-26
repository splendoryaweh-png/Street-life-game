'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Tv, CheckCircle2, Play, Sparkles } from 'lucide-react';
import { playSuccessSound, playClickSound, playPickupSound } from '@/lib/sound';

interface AdsgramThreeChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAllAdsCompleted?: () => void;
  onCompleteChain?: (totalCoins: number) => void;
}

const SPONSORS = [
  {
    step: 1,
    badge: 'Adsgram Sponsor 1/3',
    title: 'Neon Syndicate Apparel',
    tagline: 'Custom oversized tees & iced-out Cuban chains',
    accentColor: '#FFD700',
  },
  {
    step: 2,
    badge: 'Adsgram Sponsor 2/3',
    title: 'High-RPM Street Garage',
    tagline: 'Nitro refuels & street engine tuning across the globe',
    accentColor: '#00F0FF',
  },
  {
    step: 3,
    badge: 'Adsgram Sponsor 3/3',
    title: 'Worldwide Street Records',
    tagline: 'Dropping top-tier Afrobeats, Drill & Amapiano hits',
    accentColor: '#A855F7',
  },
];

function AdsgramThreeChainContent({
  onAllAdsCompleted,
  onCompleteChain,
}: {
  onAllAdsCompleted?: () => void;
  onCompleteChain?: (totalCoins: number) => void;
}) {
  const [currentAdIndex, setCurrentAdIndex] = useState(0); // 0, 1, 2
  const [secondsRemaining, setSecondsRemaining] = useState(3);
  const [isChainFinished, setIsChainFinished] = useState(false);
  const adsgramRef = useRef<unknown>(null);

  // Initialize or check real Adsgram SDK if present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as unknown as { Adsgram?: { init: (opts: { blockId: string }) => unknown } };
      if (win.Adsgram && !adsgramRef.current) {
        try {
          adsgramRef.current = win.Adsgram.init({ blockId: 'street-life-freestyle-3ad' });
        } catch (e) {
          console.warn('Adsgram init notice:', e);
        }
      }
    }
  }, []);

  // Timer loop for the 3-ads chain
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          playPickupSound();
          if (currentAdIndex < 2) {
            // Auto advance to next ad in chain
            setCurrentAdIndex((idx) => idx + 1);
            return 3;
          } else {
            // All 3 ads completed!
            clearInterval(timer);
            setIsChainFinished(true);
            playSuccessSound();
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentAdIndex]);

  const currentSponsor = SPONSORS[currentAdIndex] || SPONSORS[0];

  const handleEnterStudio = () => {
    playClickSound();
    if (onAllAdsCompleted) onAllAdsCompleted();
    if (onCompleteChain) onCompleteChain(1000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#181822] via-[#101016] to-[#0A0A0E] border-2 border-[#FFD700]/70 p-6 shadow-[0_0_40px_rgba(255,215,0,0.3)] text-center space-y-4">
        {/* Chain Progress Dots (1, 2, 3) */}
        <div className="flex items-center justify-center gap-2">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx < currentAdIndex || isChainFinished
                  ? 'w-8 bg-emerald-400'
                  : idx === currentAdIndex
                  ? 'w-10 bg-[#FFD700] animate-pulse'
                  : 'w-6 bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Sponsor Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#FFD700]/15 border border-[#FFD700]/40 flex items-center justify-center text-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.3)]">
          <Tv className="w-8 h-8" />
        </div>

        {/* Sponsor Info */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-wider text-[#FFD700]">
            <Sparkles className="w-3 h-3 text-[#FFD700]" />
            <span>{currentSponsor.badge}</span>
          </div>

          <h3 className="text-base font-black text-white tracking-tight">
            {currentSponsor.title}
          </h3>
          <p className="text-xs text-gray-400 leading-snug">
            {currentSponsor.tagline}
          </p>
        </div>

        {/* Ad Video Stream Container */}
        <div className="w-full h-36 rounded-2xl bg-black/70 border border-white/10 flex flex-col items-center justify-center relative overflow-hidden p-4 shadow-inner">
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              background: `radial-gradient(circle at center, ${currentSponsor.accentColor}, transparent 70%)`,
            }}
          />

          {!isChainFinished ? (
            <div className="relative z-10 flex flex-col items-center space-y-2.5">
              <div
                className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin flex items-center justify-center"
                style={{
                  borderRightColor: currentSponsor.accentColor,
                  borderBottomColor: currentSponsor.accentColor,
                  borderLeftColor: currentSponsor.accentColor,
                  borderTopColor: 'transparent',
                }}
              >
                <Play className="w-5 h-5 ml-0.5" style={{ color: currentSponsor.accentColor }} />
              </div>
              <span className="text-xs font-mono font-bold text-white">
                Ad {currentAdIndex + 1} of 3 • Next in {secondsRemaining}s
              </span>
              <p className="text-[10px] text-gray-400">
                Adsgram chain verifying session for audio/video recording
              </p>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center space-y-1.5 text-emerald-400">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
              <span className="text-xs font-black text-white">
                Adsgram 3-Ads Chain Completed!
              </span>
              <span className="text-[10px] text-emerald-300">
                Studio microphone & video feed unlocked!
              </span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div>
          {isChainFinished ? (
            <button
              onClick={handleEnterStudio}
              type="button"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#FFD700] via-yellow-400 to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,215,0,0.6)] active:scale-95 transition-all cursor-pointer"
            >
              <span>ENTER RECORDING BOOTH 🎙️</span>
            </button>
          ) : (
            <div className="text-[10px] text-gray-500 font-mono">
              Auto-advancing 3-ads chain ({currentAdIndex + 1}/3)...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdsgramThreeChainModal({
  isOpen,
  onClose,
  onAllAdsCompleted,
  onCompleteChain,
}: AdsgramThreeChainModalProps) {
  if (!isOpen) return null;
  return (
    <AdsgramThreeChainContent
      onAllAdsCompleted={onAllAdsCompleted}
      onCompleteChain={onCompleteChain}
    />
  );
}
