'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { cn } from '../lib/cn';

const SKELETON_DELAY_MS = 300;

/** False for the first 300 ms so fast responses never flash a skeleton. */
export function useDelayedVisibility(delayMs: number = SKELETON_DELAY_MS): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);
  return visible;
}

interface SkeletonProps {
  readonly className?: string;
}

/** One shimmering block. Use inside SkeletonGroup so the 300 ms delay is shared. */
export function Skeleton({ className }: SkeletonProps) {
  return <span aria-hidden className={cn('lt-shimmer block rounded-md', className)} />;
}

interface SkeletonGroupProps {
  /** What is loading, read by screen readers ("Loading your tasks"). */
  readonly label: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Announces loading at once; shows the shimmer only after 300 ms. */
export function SkeletonGroup({ label, children, className }: SkeletonGroupProps) {
  const visible = useDelayedVisibility();
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      <div
        aria-hidden
        className={cn(
          'transition-opacity duration-(--duration-slow)',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** A few lines of text-shaped skeleton; the last line is shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
          key={index}
          className={cn('h-3.5', index === lines - 1 ? 'w-3/5' : 'w-full')}
        />
      ))}
    </div>
  );
}
