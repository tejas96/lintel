import { useEffect, useState } from 'react';

/** Seconds since `startedAt`, ticking once a second while a session is active. */
export function useElapsedSeconds(startedAt: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  if (!startedAt) return null;
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}
