import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { api, unwrap } from '@/api/api-client';
import { useSession } from './session-provider';

const HEARTBEAT_INTERVAL_MS = 5 * 60_000;

/**
 * When the app comes to the foreground: tell the server the person is active
 * (POST /people/me/heartbeat) and re-read their capabilities, at most every
 * five minutes.
 */
export function useForegroundHeartbeat(): void {
  const { refreshUser } = useSession();
  const lastBeat = useRef(0);
  useEffect(() => {
    const beat = (rereadUser: boolean) => {
      const now = Date.now();
      if (now - lastBeat.current < HEARTBEAT_INTERVAL_MS) return;
      lastBeat.current = now;
      void unwrap(api.people.touch({ body: {} })).catch(() => undefined);
      // The person was just read at sign-in or launch; re-read only on later returns.
      if (rereadUser) void refreshUser().catch(() => undefined);
    };
    beat(false);
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') beat(true);
    });
    return () => subscription.remove();
  }, [refreshUser]);
}
