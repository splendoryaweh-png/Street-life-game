'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Tv,
  Sparkles,
  CheckCircle2,
  Play,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  getAdsgramController,
  showAdsgramRewardedAd,
} from '../lib/adsgram';

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
  const isMountedRef = useRef(false);
  const isRequestInProgressRef = useRef(false);
  const completionHandledRef = useRef(false);
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    'Preparing a rewarded advertisement...'
  );
  const [errorMessage, setErrorMessage] = useState('');

  const prepareAdsgram = useCallback(async () => {
    if (isMountedRef.current) {
      setIsSdkReady(false);
      setErrorMessage('');
      setStatusMessage('Preparing a rewarded advertisement...');
    }

    try {
      await getAdsgramController();

      if (isMountedRef.current) {
        setIsSdkReady(true);
        setErrorMessage('');
        setStatusMessage('Ready to show a rewarded advertisement.');
      }
    } catch (error: unknown) {
      if (isMountedRef.current) {
        setIsSdkReady(false);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Adsgram could not be loaded. Please try again.'
        );
        setStatusMessage('The advertisement is currently unavailable.');
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    // Defer SDK preparation so any initial state updates happen outside the effect body.
    void Promise.resolve().then(() => prepareAdsgram());

    return () => {
      isMountedRef.current = false;
    };
  }, [prepareAdsgram]);

  const handleWatchAd = useCallback(async () => {
    // A ref lock closes the small window before React applies the state update.
    if (
      isRequestInProgressRef.current ||
      !isSdkReady ||
      completionHandledRef.current
    ) {
      return;
    }

    isRequestInProgressRef.current = true;
    setIsLoading(true);
    setErrorMessage('');
    setStatusMessage('Opening the Adsgram advertisement...');

    let completed = false;

    try {
      const result = await showAdsgramRewardedAd();
      completed = result.done === true && result.error !== true;

      if (!completed) {
        throw new Error(
          result.description || 'The advertisement was not completed.'
        );
      }
    } catch (error: unknown) {
      if (isMountedRef.current) {
        setStatusMessage('The advertisement did not complete.');
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Adsgram could not complete the advertisement. Please try again.'
        );
      }
      return;
    } finally {
      isRequestInProgressRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }

    // The central Adsgram helper resolves only for a confirmed completed ad.
    // Keep completion handling outside the ad-error catch so callback errors
    // cannot be misreported as an unsuccessful advertisement.
    if (completed && !completionHandledRef.current) {
      completionHandledRef.current = true;

      if (isMountedRef.current) {
        setStatusMessage('Advertisement completed successfully.');
      }

      onAdCompleted();
      onClose();
    }
  }, [isSdkReady, onAdCompleted, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#151515] border-2 border-emerald-500/50 p-6 shadow-2xl text-center space-y-4">
        <button
          onClick={onClose}
          type="button"
          aria-label="Close advertisement"
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-[#9CA3AF] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
          <Tv className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
            Adsgram Rewarded Advertisement
          </div>
          <h3 className="text-base font-black text-white tracking-tight">
            Clear Your Police Record
          </h3>
          <p className="text-xs text-[#9CA3AF]">
            Complete the sponsored advertisement to skip the police cooldown.
          </p>
        </div>

        <div className="w-full min-h-32 rounded-2xl bg-black/60 border border-white/10 flex flex-col items-center justify-center relative overflow-hidden p-4">
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 via-transparent to-amber-500/10" />

          <div className="relative z-10 flex flex-col items-center space-y-2">
            {isLoading || (!isSdkReady && !errorMessage) ? (
              <Loader2 className="w-9 h-9 text-emerald-400 animate-spin" />
            ) : errorMessage ? (
              <AlertCircle className="w-9 h-9 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-9 h-9 text-emerald-400" />
            )}
            <span className="text-xs font-bold text-white">
              {isLoading
                ? 'Advertisement in progress...'
                : isSdkReady
                  ? 'Adsgram is ready'
                  : errorMessage
                    ? 'Adsgram unavailable'
                    : 'Loading Adsgram...'}
            </span>
            <span className="text-[10px] text-[#9CA3AF] text-center">
              {statusMessage}
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="space-y-2">
            <p role="alert" className="text-xs text-amber-300">
              {errorMessage}
            </p>
            <button
              onClick={() => void prepareAdsgram()}
              type="button"
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" />
              Retry loading Adsgram
            </button>
          </div>
        )}

        <div>
          <button
            onClick={handleWatchAd}
            type="button"
            disabled={!isSdkReady || isLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-black" />
            )}
            {isLoading
              ? 'Advertisement Running'
              : isSdkReady
                ? 'Watch Advertisement'
                : 'Preparing Advertisement'}
            {!isLoading && isSdkReady && (
              <Sparkles className="w-4 h-4" />
            )}
          </button>
          <p className="mt-2 text-[10px] text-[#9CA3AF]">
            The cooldown is cleared only after Adsgram confirms completion.
          </p>
        </div>
      </div>
    </div>
  );
}

export function AdsgramModal({
  isOpen,
  onClose,
  onAdCompleted,
}: AdsgramModalProps) {
  if (!isOpen) return null;

  return (
    <AdsgramModalContent
      onClose={onClose}
      onAdCompleted={onAdCompleted}
    />
  );
}
