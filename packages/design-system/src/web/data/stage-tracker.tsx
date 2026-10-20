'use client';

import { motion } from 'motion/react';
import { cn } from '../lib/cn';
import { easing, seconds } from '../motion/presets';

export interface TrackerStage {
  readonly id: string;
  readonly name: string;
  readonly status: 'pending' | 'active' | 'completed' | 'skipped';
  /** Share of the stage's work done (0–1); used for the active stage. */
  readonly progress?: number;
}

interface StageTrackerProps {
  readonly stages: readonly TrackerStage[];
  /** `full` prints every stage name under its segment (wide screens only). */
  readonly variant?: 'compact' | 'full';
  readonly className?: string;
}

const STATUS_WORD: Readonly<Record<TrackerStage['status'], string>> = {
  pending: 'not started',
  active: 'current',
  completed: 'complete',
  skipped: 'skipped',
};

function fillOf(stage: TrackerStage): number {
  if (stage.status === 'completed') return 1;
  if (stage.status === 'active') return Math.max(0.06, Math.min(1, stage.progress ?? 0));
  return 0;
}

/**
 * The project's workflow as a segmented bar: finished stages in slate, the
 * current one in cyanotype filled to its progress, skipped ones hatched.
 */
export function StageTracker({ stages, variant = 'compact', className }: StageTrackerProps) {
  const activeIndex = stages.findIndex((stage) => stage.status === 'active');
  const current = activeIndex >= 0 ? stages[activeIndex] : undefined;
  const summary = current
    ? `Stage ${activeIndex + 1} of ${stages.length}: ${current.name}`
    : stages.every((stage) => stage.status === 'completed' || stage.status === 'skipped')
      ? 'All stages complete'
      : `${stages.length} stages, not started`;
  if (stages.length === 0) return null;
  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      {variant === 'compact' && (
        <p className="flex items-baseline justify-between gap-3 type-body-sm">
          <span className="truncate text-ink">{current?.name ?? summary}</span>
          {current && (
            <span className="shrink-0 text-ink-faint tabular-nums">
              {activeIndex + 1}/{stages.length}
            </span>
          )}
        </p>
      )}
      <ol aria-label={summary} className="flex w-full gap-[3px]">
        {stages.map((stage, index) => (
          <li
            key={stage.id}
            className="flex min-w-0 flex-1 flex-col gap-2"
            aria-label={`${stage.name}, ${STATUS_WORD[stage.status]}`}
            aria-current={stage.status === 'active' ? 'step' : undefined}
          >
            <span
              className={cn(
                'relative block overflow-hidden rounded-full bg-sunken',
                variant === 'full' ? 'h-2' : 'h-1.5',
                stage.status === 'skipped' && 'lt-hatch',
              )}
            >
              <motion.span
                className={cn(
                  'absolute inset-y-0 left-0 w-full origin-left rounded-full',
                  stage.status === 'active' ? 'bg-accent' : 'bg-done-solid',
                )}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: fillOf(stage) }}
                transition={{
                  duration: seconds('data'),
                  ease: easing('outExpo'),
                  delay: index * 0.06,
                }}
              />
            </span>
            {variant === 'full' && (
              <span
                className={cn(
                  'truncate type-body-sm',
                  stage.status === 'active' ? 'font-medium text-ink' : 'text-ink-faint',
                )}
                title={stage.name}
              >
                {stage.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
