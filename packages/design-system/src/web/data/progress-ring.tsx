'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { dataTransition } from '../motion/presets';

interface ProgressRingProps {
  /** 0–1. Values outside are clamped. */
  readonly value: number;
  /** Accessible description, e.g. "7 of 12 checklist items done". */
  readonly label: string;
  readonly size?: number;
  readonly thickness?: number;
  /** Tailwind text colour class for the arc (defaults to ink). */
  readonly toneClassName?: string;
  readonly trackClassName?: string;
  readonly children?: ReactNode;
  readonly className?: string;
}

/** A ring that draws on to its value; put the hero number in `children`. */
export function ProgressRing({
  value,
  label,
  size = 64,
  thickness = 5,
  toneClassName = 'text-ink',
  trackClassName = 'stroke-hairline',
  children,
  className,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - thickness) / 2;
  return (
    <span
      role="img"
      aria-label={label}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        className={cn('absolute inset-0 -rotate-90', toneClassName)}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className={trackClassName}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: clamped, opacity: clamped === 0 ? 0 : 1 }}
          transition={dataTransition}
        />
      </svg>
      {children && (
        <span className="relative flex flex-col items-center leading-none">{children}</span>
      )}
    </span>
  );
}
