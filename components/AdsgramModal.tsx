'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Tv, Sparkles, CheckCircle2, Play, X, Loader2, AlertCircle } from 'lucide-react';

const ADSGRAM_BLOCK_ID = '59485';
const ADSGRAM_SCRIPT_URL = 'https://sad.adsgram.ai/js/sad.min.js';

interface AdsgramShowResult {
  done: boolean;
  description: string;
  state: 'load' | 'render' | 'playing' | 'destroy';
  error: boolean;
}

interface AdsgramController {
  show: () => Promise<AdsgramShowResult>;
}

declare global {
  interface Window {
    Adsgram?: {
      init: (options: { blockId: string }) => AdsgramController;
    };
  }
}

interface AdsgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdCompleted: () => void;
}

let adsgramScriptPromise: Promise<void> | null = null;

function loadAdsgramScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Adsgram can only load in a browser.'));
  }

  if (window.Adsgram) {
    return Promise.resolve();
  }

  if (adsgramScriptPromise) {
    return adsgramScriptPromise;
  }

  adsgramScriptPromise = new Promise<void>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${ADSGRAM_SCRIPT_URL}"]`
    );

    const handleLoad = () => {
      if (window.Adsgram) {
        resolve();
      } else {
        adsgramScriptPromise = null;
        reject(new Error('Adsgram loaded, but its SDK was not available.'));
      }
    };

    const handleError = () => {
      adsgramScriptPromise = null;
      reject(new Error('Could not load Adsgram. Please try again.'));
    };

    if (script) {
      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', handleError, { once: true });

      // The script may have finished loading before these listeners were added.
      if (script.dataset.adsgramLoaded === 'true' || script.readyState === 'complete') {
        if (window.Adsgram) {
          resolve();
        } else {
          adsgramScriptPromise = null;
          reject(new Error('Adsgram script is present but the SDK is unavailable.'));
        }
      }
      return;
    }

    script = document.createElement('script');
    script.src = ADSGRAM_SCRIPT_URL;
    script.async = true;
    script.addEventListener(
      'load',
      () => {
        script!.dataset.adsgramLoaded = 'true';
        handleLoad();
      },
      { once: true }
    );
    script.addEventListener('error', handleError, { once: true });
    document.head.appendChild(script);
  });

  return adsgramScriptPromise;
}

function AdsgramModalContent({
  onClose,
  onAdCompleted,
}: {
  onClose: () => void;
  onAdCompleted: () => void;
}) {
  const controllerRef = useRef<AdsgramController | null>(null);
  const isMountedRef = useRef(true);
  const completionHandledRef = useRef(false);
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    'Preparing a rewarded advertisement...'
  );
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    isMountedRef.current = true;

    loadAdsgramScript()
      .then(() => {
        if (isMountedRef.current) {
          setIsSdkReady(true);
          setStatusMessage('Ready to show a rewarded advertisement.');
        }
      })
      .catch((error: unknown) => {
        if (isMountedRef.current) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Adsgram could not be loaded.'
          );
          setStatusMessage('The advertisement is currently unavailable.');
        }
      });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleWatchAd = useCallback(async () => {
    if (isLoading || !isSdkReady || completionHandledRef.current) {
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setStatusMessage('Opening the Adsgram advertisement...');

    try {
      if (!window.Adsgram) {
        throw new Error('Adsgram is not available. Please close and try again.');
      }

      if (!controllerRef.current) {
        controllerRef.current = window.Adsgram.init({
          blockId: ADSGRAM_BLOCK_ID,
        });
      }

      const result = await controllerRef.current.show();

      if (result.done === true && result.error !== true) {
        completionHandledRef.current = true;
        setStatusMessage('Advertisement completed successfully.');

        // Only a confirmed rewarded-ad completion reaches the game callback.
        onAdCompleted();
        onClose();
        return;
      }

      setStatusMessage('The advertisement was not completed. No cooldown was cleared.');
      setErrorMessage('Please complete the advertisement to clear the police cooldown.');
    } catch (error: unknown) {
      setStatusMessage('The advertisement did not complete.');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Adsgram could not complete the advertisement. Please try again.'
      );
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isLoading, isSdkReady, onAdCompleted, onClose]);

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
            {isLoading ? (
              <Loader2 className="w-9 h-9 text-emerald-400 animate-spin" />
            ) : errorMessage ? (
              <AlertCircle className="w-9 h-9 text-amber-400" />
            ) : isSdkReady ? (
              <CheckCircle2 className="w-9 h-9 text-emerald-400" />
            ) : (
              <Loader2 className="w-9 h-9 text-emerald-400 animate-spin" />
            )}
            <span className="text-xs font-bold text-white">
              {isLoading
                ? 'Advertisement in progress...'
                : isSdkReady
                  ? 'Adsgram is ready'
                  : 'Loading Adsgram...'}
            </span>
            <span className="text-[10px] text-[#9CA3AF] text-center">
              {statusMessage}
            </span>
          </div>
        </div>

        {errorMessage && (
          <p role="alert" className="text-xs text-amber-300">
            {errorMessage}
          </p>
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
            {!isLoading && isSdkReady && <Sparkles className="w-4 h-4" />}
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
