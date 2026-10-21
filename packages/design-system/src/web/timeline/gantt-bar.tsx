'use client';

import { motion } from 'motion/react';
import type { PillTone } from '../data/status-pill';
import { daysFrom, shortDate } from '../lib/calendar-math';
import { cn } from '../lib/cn';
import { easing, layoutSpring, seconds } from '../motion/presets';
import type { TimelineScale } from './timeline-scale';

export const BAR_TONES: Readonly<Record<PillTone, string>> = {
  neutral: 'border-rule bg-raised text-ink',
  onTrack: 'border-on-track-solid/60 bg-on-track-tint text-on-track',
  atRisk: 'border-at-risk-solid/70 bg-at-risk-tint text-at-risk',
  blocked: 'border-blocked-solid/70 bg-blocked-tint text-blocked',
  overdue: 'border-overdue-solid/70 bg-overdue-tint text-overdue',
  review: 'border-review-solid/60 bg-review-tint text-review',
  done: 'border-done-solid/50 bg-done-tint text-done',
};

interface GanttBarProps {
  readonly scale: TimelineScale;
  readonly start: string;
  readonly end: string;
  readonly tone: PillTone;
  readonly title: string;
  /** Status word for the accessible name, e.g. "Blocked". */
  readonly statusLabel: string;
  readonly progress?: number | undefined;
  readonly index?: number;
  readonly onSelect?: (() => void) | undefined;
}

export function GanttBar({
  scale,
  start,
  end,
  tone,
  title,
  statusLabel,
  progress,
  index = 0,
  onSelect,
}: GanttBarProps) {
  const left = scale.x(start);
  const width = Math.max(scale.dayWidth, scale.x(end) + scale.dayWidth - left);
  const days = daysFrom(start, end) + 1;
  return (
    <motion.button
      type="button"
      layout
      onClick={onSelect}
      aria-label={`${title}, ${statusLabel}, ${shortDate(start)} to ${shortDate(end)}, ${days} days`}
      className={cn(
        'absolute top-2.5 flex h-6 origin-left items-center overflow-hidden rounded-md border text-left shadow-e1',
        'transition-shadow hover:shadow-e2',
        BAR_TONES[tone],
      )}
      style={{ left, width }}
      initial={{ opacity: 0, scaleX: 0.2 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{
        layout: layoutSpring,
        default: {
          duration: seconds('slow'),
          ease: easing('outQuint'),
          delay: Math.min(index, 8) * 0.03,
        },
      }}
    >
      {progress !== undefined && progress > 0 && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-current opacity-15"
          style={{ width: `${Math.min(1, progress) * 100}%` }}
        />
      )}
      <span className="relative truncate px-2 type-label">{width > 72 ? title : ''}</span>
    </motion.button>
  );
}

export function GanttMilestoneMark({
  scale,
  date,
  label,
}: {
  scale: TimelineScale;
  date: string;
  label: string;
}) {
  return (
    <span
      role="img"
      aria-label={`Milestone ${label}, ${shortDate(date)}`}
      title={`${label}, ${shortDate(date)}`}
      className="absolute top-[0.9375rem] size-3 -translate-x-1/2 rotate-45 rounded-[2px] border-2 border-ink bg-raised"
      style={{ left: scale.x(date) + scale.dayWidth / 2 }}
    />
  );
}
