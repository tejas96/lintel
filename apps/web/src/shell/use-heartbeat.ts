'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api/api-client';

const HEARTBEAT_INTERVAL_MS = 5 * 60_000;

/**
 * Tells the studio the person is active when the app comes to the foreground,
 * at most every five minutes. Failures are ignored: this is a courtesy signal.
 */
export function useHeartbeat(): void {
  useEffect(() => {
    let lastSent = 0;
    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastSent < HEARTBEAT_INTERVAL_MS) return;
      lastSent = now;
      api.people.touch({ body: {} }).catch(() => undefined);
    };
    beat();
    document.addEventListener('visibilitychange', beat);
    return () => document.removeEventListener('visibilitychange', beat);
  }, []);
}
