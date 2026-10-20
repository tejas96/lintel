'use client';

import { useEffect, useState } from 'react';

function elapsed(startedAt: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

/** A live "working for" clock for an active work session. */
export function WorkTimer({
  startedAt,
  className,
}: {
  readonly startedAt: string;
  readonly className?: string;
}) {
  const [shown, setShown] = useState(() => elapsed(startedAt));
  useEffect(() => {
    const timer = window.setInterval(() => setShown(elapsed(startedAt)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return (
    <time dateTime={startedAt} className={className}>
      <span className="sr-only">Working for </span>
      {shown}
    </time>
  );
}
