'use client';

import React, { useEffect } from 'react';

/**
 * App component initialized for Telegram Mini App
 * Calls ready() and expand() safely with optional chaining
 */
export default function App({ children }: { children?: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window?.Telegram?.WebApp?.ready?.();
        window?.Telegram?.WebApp?.expand?.();
      } catch (e) {
        console.warn('Telegram WebApp safe initialization notice:', e);
      }
    }
  }, []);

  return <>{children}</>;
}
