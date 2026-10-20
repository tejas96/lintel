'use client';

import { EmptyState, ErrorState, SkeletonGroup, SkeletonText } from '@lintel/design-system/web';
import { describeError } from '@/lib/api/describe-error';
import { LeaveRequestItem } from './leave-request-item';
import { useLeaveList } from './use-leave';

const EMPTY = {
  to_decide: {
    title: 'Nothing to decide',
    description: 'Leave requests that need your approval appear here, with their impact.',
  },
  team: {
    title: 'No leave in your team',
    description: 'When the people you look after plan time off, it shows up here.',
  },
} as const;

/** Other people's leave: waiting for my decision, or my team's. */
export function OthersLeave({
  scope,
  today,
}: {
  readonly scope: 'to_decide' | 'team';
  readonly today: string;
}) {
  const list = useLeaveList(scope, true);
  const items = [...(list.data?.items ?? [])].sort((left, right) =>
    left.startDate.localeCompare(right.startDate),
  );
  if (list.isPending) {
    return (
      <SkeletonGroup label="Loading leave requests">
        <SkeletonText lines={5} />
      </SkeletonGroup>
    );
  }
  if (list.isError) {
    return (
      <ErrorState
        {...describeError(list.error, { resource: 'collection' })}
        onRetry={() => list.refetch()}
        size="section"
      />
    );
  }
  if (items.length === 0) {
    return <EmptyState drawing="lamp" size="section" {...EMPTY[scope]} />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((request, index) => (
        <LeaveRequestItem
          key={request.id}
          request={request}
          today={today}
          index={index}
          showPerson
        />
      ))}
    </ul>
  );
}
