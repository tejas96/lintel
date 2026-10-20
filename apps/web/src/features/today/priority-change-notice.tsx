'use client';

import { Button, layoutSpring } from '@lintel/design-system/web';
import { ArrowDownUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { BUCKET_COPY, type OrderChange } from './queue-order';

function describe(change: OrderChange): string {
  const title = `“${change.item.task.title}”`;
  switch (change.kind) {
    case 'new-first':
      return `${title} is now your top priority. ${change.item.headline}`;
    case 'new':
      return `${title} was added. ${change.item.headline}`;
    case 'changed-section':
      return `${title} moved from ${BUCKET_COPY[change.fromBucket ?? change.item.bucket].title.toLowerCase()} to ${BUCKET_COPY[change.item.bucket].title.toLowerCase()}. ${change.item.headline}`;
    case 'moved-up':
      return `${title} moved up. ${change.item.headline}`;
  }
}

/**
 * The list never reorders on its own. When the server's priorities change in
 * the background, this says what moved and why, and waits for the person.
 */
export function PriorityChangeNotice({
  changes,
  onApply,
}: {
  readonly changes: readonly OrderChange[];
  readonly onApply: () => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {changes.length > 0 && (
        <motion.aside
          key="notice"
          aria-live="polite"
          aria-label="Priorities changed"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={layoutSpring}
          className="overflow-hidden"
        >
          <div className="flex flex-col gap-3 rounded-lg border border-accent/25 bg-accent-soft/60 p-4 sm:flex-row sm:items-start">
            <ArrowDownUp aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
            <div className="flex flex-1 flex-col gap-1.5">
              <p className="type-title-md text-ink">Your priorities changed</p>
              <ul className="flex flex-col gap-1 type-body-sm text-ink-muted">
                {changes.slice(0, 3).map((change) => (
                  <li key={`${change.kind}-${change.item.task.id}`}>{describe(change)}</li>
                ))}
                {changes.length > 3 && <li>And {changes.length - 3} more.</li>}
              </ul>
            </div>
            <Button size="sm" variant="primary" onClick={onApply} className="self-start">
              Show the new order
            </Button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
