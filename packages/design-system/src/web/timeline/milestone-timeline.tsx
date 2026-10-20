'use client';

import { motion } from 'motion/react';
import type { StatusGlyphName } from '../data/status-glyph';
import { type PillTone, StatusPill } from '../data/status-pill';
import { positionBetween, shortDate } from '../lib/calendar-math';
import { cn } from '../lib/cn';
import { easing, listItemEnter, seconds } from '../motion/presets';

export type MilestoneHealth = 'completed' | 'on_track' | 'at_risk' | 'missed';

export interface TimelineMilestone {
  readonly id: string;
  readonly name: string;
  readonly dueDate: string;
  readonly baselineDueDate: string;
  readonly health: MilestoneHealth;
}

const HEALTH: Readonly<
  Record<
    MilestoneHealth,
    { tone: PillTone; label: string; glyph: StatusGlyphName; diamond: string }
  >
> = {
  completed: {
    tone: 'done',
    label: 'Completed',
    glyph: 'done',
    diamond: 'bg-done-solid border-done-solid',
  },
  on_track: {
    tone: 'onTrack',
    label: 'On track',
    glyph: 'onTrack',
    diamond: 'bg-raised border-on-track-solid',
  },
  at_risk: {
    tone: 'atRisk',
    label: 'At risk',
    glyph: 'atRisk',
    diamond: 'bg-at-risk-solid border-at-risk-solid',
  },
  missed: {
    tone: 'overdue',
    label: 'Missed',
    glyph: 'overdue',
    diamond: 'bg-overdue-solid border-overdue-solid',
  },
};

interface MilestoneTimelineProps {
  readonly start: string;
  readonly end: string;
  readonly today: string;
  readonly milestones: readonly TimelineMilestone[];
  readonly className?: string;
}

/**
 * A measured line from project start to planned end: milestones sit at their
 * dates as diamonds, today is the cyanotype mark. The list below carries the
 * same facts in words for every screen size and for screen readers.
 */
export function MilestoneTimeline({
  start,
  end,
  today,
  milestones,
  className,
}: MilestoneTimelineProps) {
  const todayAt = positionBetween(today, start, end);
  const sorted = [...milestones].sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div aria-hidden className="relative hidden h-14 sm:block">
        <div className="absolute inset-x-0 top-7 h-px bg-rule" />
        <span className="absolute top-5 left-0 h-4 w-px bg-rule" />
        <span className="absolute top-5 right-0 h-4 w-px bg-rule" />
        <span className="absolute top-12 left-0 type-mono text-ink-faint">{shortDate(start)}</span>
        <span className="absolute top-12 right-0 type-mono text-ink-faint">{shortDate(end)}</span>
        <motion.div
          className="absolute inset-x-0 top-[1.6875rem] h-[3px] origin-left rounded-full bg-accent/70"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: todayAt }}
          transition={{ duration: seconds('data'), ease: easing('outExpo') }}
        />
        <div
          className="absolute top-1 bottom-2 w-px bg-accent"
          style={{ left: `${todayAt * 100}%` }}
        >
          <span className="absolute -top-1 left-1.5 type-label whitespace-nowrap text-accent">
            Today
          </span>
        </div>
        {sorted.map((milestone, index) => {
          const health = HEALTH[milestone.health];
          return (
            <motion.span
              key={milestone.id}
              title={`${milestone.name}, ${shortDate(milestone.dueDate)}, ${health.label}`}
              className={cn(
                'absolute top-[1.375rem] size-3 -translate-x-1/2 rotate-45 rounded-[2px] border-2',
                health.diamond,
              )}
              style={{ left: `${positionBetween(milestone.dueDate, start, end) * 100}%` }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: seconds('slow'), delay: 0.25 + index * 0.05 }}
            />
          );
        })}
      </div>
      <ol className="flex flex-col divide-y divide-hairline">
        {sorted.map((milestone, index) => {
          const health = HEALTH[milestone.health];
          const slipped = milestone.dueDate !== milestone.baselineDueDate;
          return (
            <motion.li
              key={milestone.id}
              {...listItemEnter(index)}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
            >
              <span className="w-16 shrink-0 type-mono text-ink-muted">
                {shortDate(milestone.dueDate)}
              </span>
              <span className="min-w-0 flex-1 type-body text-ink">{milestone.name}</span>
              {slipped && (
                <span className="type-body-sm text-ink-faint">
                  Planned {shortDate(milestone.baselineDueDate)}
                </span>
              )}
              <StatusPill tone={health.tone} label={health.label} glyph={health.glyph} size="sm" />
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
