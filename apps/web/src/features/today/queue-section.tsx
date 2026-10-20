'use client';

import type { TaskSummary, WorkQueueItem } from '@lintel/api-contracts';
import { cn, layoutSpring } from '@lintel/design-system/web';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useId, useState } from 'react';
import { BUCKET_COPY, type Bucket } from './queue-order';
import { TaskRow } from './task-row';

interface QueueSectionProps {
  readonly bucket: Bucket;
  readonly items: readonly WorkQueueItem[];
  readonly today: string;
  readonly onBeforeChange: () => void;
  readonly onReportBlocker: (task: TaskSummary) => void;
  readonly collapsedByDefault?: boolean;
}

const COUNT_TONE: Partial<Record<Bucket, string>> = {
  overdue: 'bg-overdue-tint text-overdue',
  blocked: 'bg-blocked-tint text-blocked',
  in_review: 'bg-review-tint text-review',
};

export function QueueSection({
  bucket,
  items,
  today,
  onBeforeChange,
  onReportBlocker,
  collapsedByDefault = false,
}: QueueSectionProps) {
  const [open, setOpen] = useState(!collapsedByDefault);
  const headingId = useId();
  const listId = useId();
  if (items.length === 0) return null;
  const copy = BUCKET_COPY[bucket];
  return (
    <motion.section
      layout="position"
      transition={layoutSpring}
      aria-labelledby={headingId}
      className="flex flex-col gap-1"
    >
      <header className="flex items-end justify-between gap-3 px-3">
        <div className="flex flex-col gap-0.5">
          <h2 id={headingId} className="flex items-center gap-2 type-title-md text-ink">
            {copy.title}
            <span
              className={cn(
                'rounded-full px-2 py-px text-[0.75rem] font-semibold tabular-nums',
                COUNT_TONE[bucket] ?? 'bg-sunken text-ink-muted',
              )}
            >
              {items.length}
            </span>
          </h2>
          <p className="type-body-sm text-ink-faint">{copy.description}</p>
        </div>
        {collapsedByDefault && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((value) => !value)}
            className="flex min-h-11 items-center gap-1 rounded-md px-2 type-body-sm text-ink-muted hover:text-ink"
          >
            {open ? 'Hide' : 'Show'}
            <ChevronDown
              aria-hidden
              className={cn('size-4 transition-transform', open && 'rotate-180')}
            />
          </button>
        )}
      </header>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            id={listId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={layoutSpring}
            className="flex flex-col overflow-hidden"
          >
            {items.map((item) => (
              <TaskRow
                key={item.task.id}
                task={item.task}
                today={today}
                onBeforeChange={onBeforeChange}
                onReportBlocker={onReportBlocker}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
