'use client';

import type { WorkQueueItem } from '@lintel/api-contracts';
import { pageEnter } from '@lintel/design-system/web';
import { CalendarClock, Flag, Hourglass } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { formatCalendarDate, formatMinutes } from '@/lib/format/dates';
import { DueRuler } from './due-ruler';
import { HeroActions } from './hero-actions';
import { PriorityReasons } from './priority-reasons';

interface NextPriorityHeroProps {
  readonly item: WorkQueueItem | null;
  readonly today: string;
  readonly onBeforeChange: () => void;
  readonly onReportBlocker: () => void;
}

/** Registration marks in the corners, as on a drawing sheet. */
function SheetCorners() {
  const corner = 'absolute size-3 border-on-blueprint/40';
  return (
    <span aria-hidden>
      <span className={`${corner} top-3 left-3 border-t border-l`} />
      <span className={`${corner} top-3 right-3 border-t border-r`} />
      <span className={`${corner} bottom-3 left-3 border-b border-l`} />
      <span className={`${corner} right-3 bottom-3 border-r border-b`} />
    </span>
  );
}

/**
 * The day's one most important task on a cyanotype sheet: what it is, the
 * server's reason it comes first, how much time is left, and the next step.
 */
export function NextPriorityHero({
  item,
  today,
  onBeforeChange,
  onReportBlocker,
}: NextPriorityHeroProps) {
  if (!item) {
    return (
      <motion.section
        {...pageEnter}
        aria-label="Next priority"
        className="lt-blueprint-grid relative overflow-hidden rounded-xl px-6 py-10 text-on-blueprint sm:px-10"
      >
        <SheetCorners />
        <p className="type-label text-on-blueprint-muted">Next priority</p>
        <h2 className="mt-3 max-w-xl type-display-md text-balance sm:type-display-lg">
          Nothing is waiting on you right now.
        </h2>
        <p className="mt-3 max-w-lg type-body text-on-blueprint-muted">
          When work is assigned to you, the most important piece appears here with the reason it
          comes first.
        </p>
      </motion.section>
    );
  }
  const { task } = item;
  return (
    <motion.section
      {...pageEnter}
      aria-labelledby="next-priority-title"
      className="lt-blueprint-grid relative overflow-hidden rounded-xl text-on-blueprint shadow-e2"
    >
      <SheetCorners />
      <div className="grid gap-8 px-6 py-7 sm:px-9 sm:py-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 type-body-sm text-on-blueprint-muted">
            <span className="type-label text-on-blueprint">Next priority</span>
            <span className="font-mono text-[0.75rem]">{task.project.reference}</span>
            <span className="truncate">{task.project.name}</span>
          </div>
          <div className="flex flex-col gap-3">
            <h2
              id="next-priority-title"
              className="type-display-md text-balance sm:type-display-lg"
            >
              <Link
                href={`/tasks/${task.id}`}
                className="rounded-sm decoration-on-blueprint/40 underline-offset-[6px] hover:underline"
              >
                {task.title}
              </Link>
            </h2>
            <p className="max-w-xl type-body text-on-blueprint-muted">{item.headline}</p>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 type-body-sm text-on-blueprint-muted">
            {task.stage && (
              <li className="inline-flex items-center gap-1.5">
                <Flag aria-hidden className="size-3.5" />
                {task.stage.name}
              </li>
            )}
            {task.milestone && (
              <li className="inline-flex items-center gap-1.5">
                <CalendarClock aria-hidden className="size-3.5" />
                {task.milestone.name}, {formatCalendarDate(task.milestone.dueDate, today)}
              </li>
            )}
            {task.estimateMinutes !== null && (
              <li className="inline-flex items-center gap-1.5">
                <Hourglass aria-hidden className="size-3.5" />
                About {formatMinutes(task.estimateMinutes)}
              </li>
            )}
          </ul>
          {task.dueDate && <DueRuler today={today} dueDate={task.dueDate} />}
          <HeroActions
            task={task}
            onBeforeChange={onBeforeChange}
            onReportBlocker={onReportBlocker}
          />
        </div>
        <PriorityReasons reasons={item.reasons} />
      </div>
    </motion.section>
  );
}
