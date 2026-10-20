'use client';

import type { TaskDetail } from '@lintel/api-contracts';
import { SkeletonText } from '@lintel/design-system/web';
import { DetailSection } from '@/features/tasks/detail/detail-section';
import { DeliverableItem } from './deliverable-item';
import { useProjectDeliverables } from './use-deliverables';

/** Deliverables that belong to this task, with their versions and reviews. */
export function TaskDeliverables({ task }: { readonly task: TaskDetail }) {
  const deliverables = useProjectDeliverables(task.project.id);
  const mine = (deliverables.data ?? []).filter((deliverable) => deliverable.task?.id === task.id);
  if (deliverables.isSuccess && mine.length === 0) return null;
  if (deliverables.isError) return null;
  return (
    <DetailSection title="Deliverables" meta={mine.length > 0 ? String(mine.length) : undefined}>
      {deliverables.isPending ? (
        <SkeletonText lines={2} />
      ) : (
        <ul className="flex flex-col gap-2">
          {mine.map((deliverable) => (
            <DeliverableItem key={deliverable.id} deliverable={deliverable} />
          ))}
        </ul>
      )}
    </DetailSection>
  );
}
