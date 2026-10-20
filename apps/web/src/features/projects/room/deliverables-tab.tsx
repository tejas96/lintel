'use client';

import type { DeliverableSummary } from '@lintel/api-contracts';
import { EmptyState, ErrorState, SkeletonGroup, SkeletonText } from '@lintel/design-system/web';
import type { DeliverableStatus } from '@lintel/domain';
import { DeliverableItem } from '@/features/deliverables/deliverable-item';
import { useProjectDeliverables } from '@/features/deliverables/use-deliverables';
import { describeError } from '@/lib/api/describe-error';

const GROUPS: readonly { title: string; statuses: readonly DeliverableStatus[] }[] = [
  { title: 'Waiting for review', statuses: ['in_review'] },
  { title: 'Needs another version', statuses: ['changes_requested', 'rejected'] },
  { title: 'Not submitted yet', statuses: ['not_submitted'] },
  { title: 'Approved', statuses: ['approved'] },
];

/** Deliverables grouped by what they need next. */
export function DeliverablesTab({ projectId }: { readonly projectId: string }) {
  const deliverables = useProjectDeliverables(projectId);
  if (deliverables.isPending)
    return (
      <SkeletonGroup label="Loading deliverables">
        <SkeletonText lines={6} />
      </SkeletonGroup>
    );
  if (deliverables.isError)
    return (
      <ErrorState
        {...describeError(deliverables.error, { resource: 'collection' })}
        onRetry={() => deliverables.refetch()}
      />
    );
  if (deliverables.data.length === 0) {
    return (
      <EmptyState
        drawing="drafting"
        title="No deliverables on this project"
        description="Drawings, boards and documents to hand over appear here with every version and review."
      />
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {GROUPS.map((group) => {
        const items: DeliverableSummary[] = deliverables.data.filter((deliverable) =>
          group.statuses.includes(deliverable.status),
        );
        if (items.length === 0) return null;
        return (
          <section key={group.title} className="flex flex-col gap-3">
            <h2 className="flex items-baseline gap-2 type-title-md text-ink">
              {group.title}
              <span className="type-body-sm font-normal text-ink-faint tabular-nums">
                {items.length}
              </span>
            </h2>
            <ul className="flex flex-col gap-2">
              {items.map((deliverable) => (
                <DeliverableItem key={deliverable.id} deliverable={deliverable} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
