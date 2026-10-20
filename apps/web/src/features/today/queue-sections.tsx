'use client';

import type { TaskSummary, WorkQueueItem } from '@lintel/api-contracts';
import { EmptyState } from '@lintel/design-system/web';
import { LayoutGroup } from 'motion/react';
import { BUCKET_ORDER } from './queue-order';
import { QueueSection } from './queue-section';

interface QueueSectionsProps {
  readonly items: readonly WorkQueueItem[];
  readonly today: string;
  readonly strategy: string;
  readonly onBeforeChange: () => void;
  readonly onReportBlocker: (task: TaskSummary) => void;
}

/** Every remaining task, grouped by where it stands, in the order last shown. */
export function QueueSections({
  items,
  today,
  strategy,
  onBeforeChange,
  onReportBlocker,
}: QueueSectionsProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        size="section"
        drawing="chair"
        title="That’s everything for now"
        description="Nothing else is assigned to you. New work will appear here, already in order."
      />
    );
  }
  return (
    <LayoutGroup>
      <div className="flex flex-col gap-8">
        {BUCKET_ORDER.map((bucket) => (
          <QueueSection
            key={bucket}
            bucket={bucket}
            items={items.filter((item) => item.bucket === bucket)}
            today={today}
            onBeforeChange={onBeforeChange}
            onReportBlocker={onReportBlocker}
            collapsedByDefault={bucket === 'later'}
          />
        ))}
        <details className="group rounded-md px-3 type-body-sm text-ink-faint">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-ink-muted hover:text-ink">
            How this list is ordered
          </summary>
          <p className="max-w-2xl pb-2">{strategy}</p>
        </details>
      </div>
    </LayoutGroup>
  );
}
