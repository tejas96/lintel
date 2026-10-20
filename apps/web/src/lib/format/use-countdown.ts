'use client';

import { useCallback, useEffect, useState } from 'react';

/** Seconds left until a deadline, ticking once a second; restart with `start(seconds)`. */
export function useCountdown(initialSeconds = 0): {
  remaining: number;
  start: (seconds: number) => void;
} {
  const [deadline, setDeadline] = useState<number | null>(
    initialSeconds > 0 ? Date.now() + initialSeconds * 1000 : null,
  );
  const [remaining, setRemaining] = useState(Math.max(0, initialSeconds));

  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setDeadline(null);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  const start = useCallback((seconds: number) => {
    setRemaining(Math.max(0, seconds));
    setDeadline(seconds > 0 ? Date.now() + seconds * 1000 : null);
  }, []);

  return { remaining, start };
}

/** 75 → "1:15". */
export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
