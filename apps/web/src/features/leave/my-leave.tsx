'use client';

import {
  EmptyState,
  ErrorState,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
} from '@lintel/design-system/web';
import { describeError } from '@/lib/api/describe-error';
import { LeaveBalances } from './leave-balances';
import { LeaveRequestItem } from './leave-request-item';
import { useLeaveBalances, useMyLeaveRequests } from './use-leave';

const UPCOMING = new Set(['pending', 'info_requested', 'approved']);

/** The person's own leave: what is left this year, what is coming up, and what is closed. */
export function MyLeave({ today }: { readonly today: string }) {
  const balances = useLeaveBalances();
  const requests = useMyLeaveRequests();
  const items = requests.data?.items ?? [];
  const upcoming = items.filter(
    (request) => UPCOMING.has(request.status) && request.endDate >= today,
  );
  const past = items.filter((request) => !upcoming.includes(request));
  return (
    <div className="flex flex-col gap-8">
      {balances.isPending && (
        <SkeletonGroup
          label="Loading your leave balances"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[0, 1, 2, 3].map((tile) => (
            <Skeleton key={tile} className="h-24 rounded-lg" />
          ))}
        </SkeletonGroup>
      )}
      {balances.data && <LeaveBalances balances={balances.data} />}
      {requests.isPending && (
        <SkeletonGroup label="Loading your leave">
          <SkeletonText lines={4} />
        </SkeletonGroup>
      )}
      {requests.isError && (
        <ErrorState
          {...describeError(requests.error, { resource: 'collection' })}
          onRetry={() => requests.refetch()}
        />
      )}
      {requests.data && items.length === 0 && (
        <EmptyState
          drawing="lamp"
          title="No leave planned"
          description="Request time off here. You’ll see the work it affects and who else is away before you send it."
        />
      )}
      {upcoming.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="type-title-md text-ink">Coming up</h2>
          <ul className="flex flex-col gap-2">
            {upcoming.map((request, index) => (
              <LeaveRequestItem key={request.id} request={request} today={today} index={index} />
            ))}
          </ul>
        </section>
      )}
      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="type-title-md text-ink">Earlier and closed</h2>
          <ul className="flex flex-col gap-2">
            {past.map((request, index) => (
              <LeaveRequestItem key={request.id} request={request} today={today} index={index} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
