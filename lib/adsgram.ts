'use client';

/**
 * STREET LIFE — Central Adsgram Integration
 *
 * Adsgram Reward Block ID: 61133
 *
 * Responsibilities:
 * - Load the Adsgram SDK once and handle an already-present script safely.
 * - Initialize one shared rewarded-ad controller.
 * - Prevent overlapping rewarded advertisements.
 * - Report success only when Adsgram explicitly returns done === true.
 * - Never award coins or game items from this module.
 */

const ADSGRAM_BLOCK_ID = '61133';
const ADSGRAM_SCRIPT_URL = 'https://sad.adsgram.ai/js/sad.min.js';
const ADSGRAM_LOAD_TIMEOUT_MS = 15_000;

export interface AdsgramShowResult {
  done: boolean;
  description: string;
  state: 'load' | 'render' | 'playing' | 'destroy';
  error: boolean;
}

export interface AdsgramController {
  show: () => Promise<AdsgramShowResult>;
  destroy?: () => void;
}

interface AdsgramSDK {
  init: (options: {
    blockId: string;
    debug?: boolean;
  }) => AdsgramController;
}

declare global {
  interface Window {
    Adsgram?: AdsgramSDK;
  }
}

let sdkLoadPromise: Promise<AdsgramSDK> | null = null;
let controllerPromise: Promise<AdsgramController> | null = null;
let adsgramController: AdsgramController | null = null;
let isShowingAd = false;

/**
 * Load Adsgram in the browser. If another part of the app has already
 * inserted the SDK script, reuse it instead of inserting a duplicate.
 */
function loadAdsgramSDK(): Promise<AdsgramSDK> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Adsgram can only run in the browser.'));
  }

  if (window.Adsgram) {
    return Promise.resolve(window.Adsgram);
  }

  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  const pending = new Promise<AdsgramSDK>((resolve, reject) => {
    let script = Array.from(document.scripts).find(
      (candidate) => candidate.src === ADSGRAM_SCRIPT_URL
    );
    let settled = false;
    let timeoutId: number | undefined;

    const cleanup = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      script?.removeEventListener('load', handleLoad);
      script?.removeEventListener('error', handleError);
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (error) {
        reject(error);
        return;
      }

      if (!window.Adsgram || typeof window.Adsgram.init !== 'function') {
        reject(new Error('Adsgram SDK loaded, but its API was not found.'));
        return;
      }

      resolve(window.Adsgram);
    };

    const handleLoad = () => finish();
    const handleError = () =>
      finish(new Error('Unable to load the Adsgram advertising SDK.'));

    timeoutId = window.setTimeout(() => {
      finish(new Error('Adsgram SDK loading timed out.'));
    }, ADSGRAM_LOAD_TIMEOUT_MS);

    if (!script) {
      script = document.createElement('script');
      script.src = ADSGRAM_SCRIPT_URL;
      script.async = true;
    }

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    // The SDK may have become available between the first check and
    // listener registration, or the script may already have loaded.
    if (window.Adsgram) {
      finish();
      return;
    }

    if (!script.isConnected) {
      document.head.appendChild(script);
    }
  });

  sdkLoadPromise = pending;

  // A failed load must be retryable on the next user attempt.
  void pending.catch(() => {
    if (sdkLoadPromise === pending) {
      sdkLoadPromise = null;
    }
  });

  return pending;
}

/** Return the single shared Adsgram controller. */
export async function getAdsgramController(): Promise<AdsgramController> {
  if (adsgramController) {
    return adsgramController;
  }

  if (controllerPromise) {
    return controllerPromise;
  }

  const pending = (async () => {
    const sdk = await loadAdsgramSDK();

    if (!sdk || typeof sdk.init !== 'function') {
      throw new Error('Adsgram initialization is unavailable.');
    }

    const controller = sdk.init({
      blockId: ADSGRAM_BLOCK_ID,
      debug: false,
    });

    if (!controller || typeof controller.show !== 'function') {
      throw new Error('Adsgram controller could not be initialized.');
    }

    adsgramController = controller;
    return controller;
  })();

  controllerPromise = pending;

  try {
    return await pending;
  } finally {
    if (controllerPromise === pending) {
      controllerPromise = null;
    }
  }
}

/**
 * Show one rewarded advertisement. The caller must grant its own reward
 * only after this function resolves successfully.
 */
export async function showAdsgramRewardedAd(): Promise<AdsgramShowResult> {
  if (isShowingAd) {
    throw new Error('An advertisement is already playing.');
  }

  // Set the lock before the first await so two rapid calls cannot overlap.
  isShowingAd = true;

  try {
    const controller = await getAdsgramController();
    const result = await controller.show();

    if (!result || result.done !== true || result.error === true) {
      throw new Error(
        result?.description || 'The advertisement was not completed.'
      );
    }

    return result;
  } finally {
    isShowingAd = false;
  }
}

/** Check whether a rewarded advertisement is currently in progress. */
export function isAdsgramAdShowing(): boolean {
  return isShowingAd;
}

/**
 * Clear a cached controller after a known SDK/controller failure.
 * Do not unlock or destroy an advertisement while it is in progress.
 */
export function resetAdsgramController(): void {
  if (isShowingAd) {
    return;
  }

  try {
    adsgramController?.destroy?.();
  } catch {
    // Resetting the cache must remain safe even if SDK cleanup fails.
  }

  adsgramController = null;
  controllerPromise = null;
  sdkLoadPromise = null;
}
