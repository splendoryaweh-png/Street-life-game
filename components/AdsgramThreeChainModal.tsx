'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Tv, CheckCircle2, Play, Sparkles, X, Loader2 } from 'lucide-react';
import { playSuccessSound, playClickSound, playPickupSound } from '@/lib/sound';

interface AdsgramThreeChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAllAdsCompleted?: () => void;
  onCompleteChain?: (totalCoins: number) => void;
}

type AdsgramShowResult = {
  done: boolean;
  description?: string;
  state?: 'load' | 'render' | 'playing' | 'destroy';
  error?: boolean;
};

type AdsgramController = {
  show: () => Promise<AdsgramShowResult>;
};

declare global {
  interface Window {
    Adsgram?: {
      init: (options: { blockId: string }) => AdsgramController;
    };
  }
}

const ADSGRAM_BLOCK_ID = '59485';
const ADSGRAM_SCRIPT_URL = 'https://sad.adsgram.ai/js/sad.min.js';
const TOTAL_ADS = 3;
const TOTAL_CHAIN_REWARD = 10;

function loadAdsgramSdk(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Ads are only available in the browser.'));
  }

  if (window.Adsgram) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${ADSGRAM_SCRIPT_URL}"]`
    );

    if (existing) {
      if (window.Adsgram) {
        resolve();
        return;
      }

      const onLoad = () => {
        cleanup();
        window.Adsgram
          ? resolve()
          : reject(new Error('Adsgram SDK did not initialize.'));
      };
      const onError = () => {
        cleanup();
        reject(new Error('Could not load Adsgram.'));
      };
      const cleanup = () => {
        existing.removeEventListener('load', onLoad);
        existing.removeEventListener('error', onError);
      };

      existing.addEventListener('load', onLoad, { once: true });
      existing.addEventListener('error', onError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = ADSGRAM_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      window.Adsgram
        ? resolve()
        : reject(new Error('Adsgram SDK did not initialize.'));
    };
    script.onerror = () => reject(new Error('Could not load Adsgram.'));
    document.head.appendChild(script);
  });
}

function AdsgramThreeChainContent({
  onClose,
  onAllAdsCompleted,
  onCompleteChain,
}: {
  onClose: () => void;
  onAllAdsCompleted?: () => void;
  onCompleteChain?: (totalCoins: number) => void;
}) {
  const [completedAds, setCompletedAds] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isChainFinished, setIsChainFinished] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    'Complete three real Adsgram advertisements to unlock the recording booth.'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const isRunningRef = useRef(false);
  const hasAwardedRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleStartChain = async () => {
    if (isRunningRef.current || hasAwardedRef.current || isChainFinished) return;

    isRunningRef.current = true;
    setIsStarting(true);
    setErrorMessage('');

    try {
      await loadAdsgramSdk();

      if (!window.Adsgram) {
        throw new Error('Adsgram is unavailable.');
      }

      for (let adNumber = completedAds + 1; adNumber <= TOTAL_ADS; adNumber += 1) {
        if (!isMountedRef.current) return;

        setStatusMessage(`Loading Adsgram advertisement ${adNumber} of ${TOTAL_ADS}...`);

        const controller = window.Adsgram.init({ blockId: ADSGRAM_BLOCK_ID });
        const result = await controller.show();

        if (!result || result.done !== true || result.error === true) {
          throw new Error(`Advertisement ${adNumber} was not completed. No chain reward was issued.`);
        }

        if (!isMountedRef.current) return;

        setCompletedAds(adNumber);
        playPickupSound();
        setStatusMessage(
          adNumber < TOTAL_ADS
            ? `Ad ${adNumber} completed. Preparing the next advertisement...`
            : 'All three advertisements have been completed.'
        );
      }

      if (!isMountedRef.current || hasAwardedRef.current) return;

      hasAwardedRef.current = true;
      setIsChainFinished(true);
      setStatusMessage('All three Adsgram advertisements were confirmed. Your 10-coin reward is ready.');
      playSuccessSound();
    } catch (error) {
      console.error('Adsgram three-ad chain error:', error);
      if (isMountedRef.current) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Adsgram could not complete the chain. Please try again.'
        );
        setStatusMessage('The chain was not completed. No coins have been awarded.');
      }
    } finally {
      isRunningRef.current = false;
      if (isMountedRef.current) setIsStarting(false);
    }
  };

  const handleEnterStudio = () => {
    if (!isChainFinished || !hasAwardedRef.current) return;

    playClickSound();
    onAllAdsCompleted?.();
    onCompleteChain?.(TOTAL_CHAIN_REWARD);
  };

  const handleClose = () => {
    if (isStarting) return;
    playClickSound();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#181822] via-[#101016] to-[#0A0A0E] border-2 border-[#FFD700]/70 p-6 shadow-[0_0_40px_rgba(255,215,0,0.3)] text-center space-y-4">
        <button
          type="button"
          onClick={handleClose}
          disabled={isStarting}
          aria-label="Close Adsgram chain"
          className="absolute right-3 top-3 rounded-full p-2 text-gray-400 hover:text-white disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center justify-center gap-2 pt-2">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx < completedAds
                  ? 'w-8 bg-emerald-400'
                  : idx === completedAds && !isChainFinished
                    ? 'w-10 bg-[#FFD700]'
                    : 'w-6 bg-white/20'
              }`}
            />
          ))}
        </div>

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#FFD700]/40 bg-[#FFD700]/15 text-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.3)]">
          <Tv className="h-8 w-8" />
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#FFD700]">
            <Sparkles className="h-3 w-3 text-[#FFD700]" />
            <span>Adsgram rewarded ads · {completedAds}/{TOTAL_ADS}</span>
          </div>
          <h3 className="text-base font-black tracking-tight text-white">
            Three-Ad Recording Booth Unlock
          </h3>
          <p className="text-xs leading-snug text-gray-400">
            Watch and complete three real Adsgram advertisements. The total reward is fixed at 10 coins.
          </p>
        </div>

        <div className="relative flex h-36 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/70 p-4 shadow-inner">
          <div className="pointer-events-none absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at center, #FFD700, transparent 70%)' }} />
          {isChainFinished ? (
            <div className="relative z-10 flex flex-col items-center space-y-1.5 text-emerald-400">
              <CheckCircle2 className="h-10 w-10 animate-bounce text-emerald-400" />
              <span className="text-xs font-black text-white">Three Ads Completed!</span>
              <span className="text-[10px] text-emerald-300">10 coins total · Recording booth unlocked</span>
            </div>
          ) : isStarting ? (
            <div className="relative z-10 flex flex-col items-center space-y-2">
              <Loader2 className="h-9 w-9 animate-spin text-[#FFD700]" />
              <span className="text-xs font-bold text-white">Adsgram is running</span>
              <span className="text-[10px] text-gray-400">{statusMessage}</span>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center space-y-2">
              <Play className="h-9 w-9 text-[#FFD700]" />
              <span className="text-xs font-bold text-white">{completedAds} of {TOTAL_ADS} ads completed</span>
              <span className="text-[10px] text-gray-400">Only confirmed completions count</span>
            </div>
          )}
        </div>

        <p className="text-[11px] text-gray-300" role="status" aria-live="polite">
          {statusMessage}
        </p>

        {errorMessage && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-[10px] text-red-300" role="alert">
            {errorMessage}
          </p>
        )}

        <div>
          {isChainFinished ? (
            <button
              onClick={handleEnterStudio}
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FFD700] via-yellow-400 to-amber-500 py-3.5 text-xs font-black uppercase tracking-wider text-black shadow-[0_0_20px_rgba(255,215,0,0.6)] transition-all active:scale-95"
            >
              <span>ENTER RECORDING BOOTH 🎙️</span>
            </button>
          ) : (
            <button
              onClick={handleStartChain}
              type="button"
              disabled={isStarting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FFD700] via-yellow-400 to-amber-500 py-3.5 text-xs font-black uppercase tracking-wider text-black shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              <span>{isStarting ? 'ADS IN PROGRESS...' : completedAds > 0 ? 'RETRY REMAINING ADS' : 'START THREE ADS'}</span>
            </button>
          )}
        </div>

        <p className="text-[10px] text-gray-500">
          Ads must be completed successfully. Failed or skipped ads do not earn coins.
        </p>
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
      onClose={onClose}
      onAllAdsCompleted={onAllAdsCompleted}
      onCompleteChain={onCompleteChain}
    />
  );
}
