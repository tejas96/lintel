'use client';

import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  pageEnter,
  Skeleton,
  SkeletonGroup,
} from '@lintel/design-system/web';
import { CalendarPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { describeError } from '@/lib/api/describe-error';
import { todayIn } from '@/lib/format/dates';
import { LeaveBalances } from './leave-balances';
import { LeaveRequestItem } from './leave-request-item';
import { RequestLeaveSheet } from './request-leave-sheet';
import { useLeaveBalances, useLeaveTypes, useMyLeaveRequests } from './use-leave';

const UPCOMING = new Set(['pending', 'info_requested', 'approved']);

/** The person's own leave: what is left, what is planned, and a request that shows its impact first. */
export function LeaveView() {
  const { user } = useSession();
  const today = todayIn(user.timeZone);
  const types = useLeaveTypes();
  const balances = useLeaveBalances();
  const requests = useMyLeaveRequests();
  const [requesting, setRequesting] = useState(false);
  const items = requests.data?.items ?? [];
  const upcoming = items.filter(
    (request) => UPCOMING.has(request.status) && request.endDate >= today,
  );
  const past = items.filter((request) => !upcoming.includes(request));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-6 md:px-10 md:py-9">
      <motion.div {...pageEnter}>
        <PageHeader
          title="Leave"
          description="Your time off, what’s left this year, and requests on their way to approval."
          actions={
            <Button
              variant="primary"
              leadingIcon={<CalendarPlus aria-hidden />}
              onClick={() => setRequesting(true)}
              disabled={!types.data}
            >
              Request leave
            </Button>
          }
        />
      </motion.div>
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
            {upcoming.map((request) => (
              <LeaveRequestItem key={request.id} request={request} today={today} />
            ))}
          </ul>
        </section>
      )}
      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="type-title-md text-ink">Earlier and closed</h2>
          <ul className="flex flex-col gap-2">
            {past.map((request) => (
              <LeaveRequestItem key={request.id} request={request} today={today} />
            ))}
          </ul>
        </section>
      )}
      {types.data && (
        <RequestLeaveSheet
          open={requesting}
          onOpenChange={setRequesting}
          types={types.data}
          today={today}
        />
      )}
    </div>
  );
}
