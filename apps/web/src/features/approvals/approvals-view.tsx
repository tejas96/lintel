'use client';

import type { ApprovalItem } from '@lintel/api-contracts';
import {
  ApprovalCard,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  pageEnter,
  Skeleton,
  SkeletonGroup,
} from '@lintel/design-system/web';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import Link from 'next/link';
import { api, expectStatus } from '@/lib/api/api-client';
import { describeError } from '@/lib/api/describe-error';
import { formatRelativeInstant } from '@/lib/format/dates';
import { queryKeys } from '@/lib/query/query-keys';

/** `onWeb` is false where the deciding screen is not in the web app yet. */
const KINDS: Readonly<
  Record<ApprovalItem['type'], { label: string; action: string; onWeb: boolean }>
> = {
  task_review: { label: 'Task review', action: 'Review the task', onWeb: true },
  deliverable_review: {
    label: 'Deliverable review',
    action: 'Review the deliverable',
    onWeb: true,
  },
  scope_change: { label: 'Scope change', action: 'See the impact and decide', onWeb: true },
  leave_request: { label: 'Leave request', action: 'See the impact and decide', onWeb: true },
  reward_review: { label: 'Reward review', action: 'Review the reward', onWeb: true },
  priority_conflict: { label: 'Priority conflict', action: 'Resolve the conflict', onWeb: false },
  reassignment_request: {
    label: 'Reassignment request',
    action: 'Read the request and decide',
    onWeb: true,
  },
  date_change_request: {
    label: 'New-date request',
    action: 'Accept or decline the new date',
    onWeb: true,
  },
  leave_handover: { label: 'Cover while away', action: 'Open the handover', onWeb: true },
};

/** Reward reviews are decided in the review queue of the rewards screen. */
function webPathOf(item: ApprovalItem): string {
  if (item.type !== 'reward_review') return item.linkPath;
  return item.linkPath.startsWith('/rewards/review') ? item.linkPath : '/rewards/review';
}

/** Everything waiting for this person's decision, most urgent first, each a step from its page. */
export function ApprovalsView() {
  const approvals = useQuery({
    queryKey: queryKeys.approvals,
    queryFn: () => expectStatus(api.deliverables.myApprovalQueue(), 200),
    refetchInterval: 60_000,
  });
  const items = [...(approvals.data ?? [])].sort((left, right) =>
    left.urgency === right.urgency
      ? left.requestedAt.localeCompare(right.requestedAt)
      : left.urgency === 'high'
        ? -1
        : 1,
  );
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-5 py-6 md:px-10 md:py-9">
      <motion.div {...pageEnter}>
        <PageHeader
          title="Approvals"
          description={
            approvals.data
              ? items.length === 0
                ? 'Nothing is waiting for your decision.'
                : `${items.length} ${items.length === 1 ? 'decision is' : 'decisions are'} waiting for you. Others can’t move until you decide.`
              : 'Decisions waiting for you.'
          }
        />
      </motion.div>
      {approvals.isPending && (
        <SkeletonGroup label="Loading approvals" className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((card) => (
            <Skeleton key={card} className="h-44 rounded-lg" />
          ))}
        </SkeletonGroup>
      )}
      {approvals.isError && (
        <ErrorState
          {...describeError(approvals.error, { resource: 'collection' })}
          onRetry={() => approvals.refetch()}
        />
      )}
      {approvals.data && items.length === 0 && (
        <EmptyState
          drawing="lamp"
          title="You’re all caught up"
          description="Reviews, scope changes, leave and reassignment requests that need you will appear here."
        />
      )}
      {items.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => {
            const kind = KINDS[item.type];
            return (
              <ApprovalCard
                key={`${item.type}-${item.id}`}
                kind={kind.label}
                title={item.title}
                subtitle={item.subtitle}
                requestedBy={item.requestedBy}
                requestedWhen={formatRelativeInstant(item.requestedAt)}
                urgent={item.urgency === 'high'}
                actions={
                  kind.onWeb ? (
                    <Button asChild variant="primary" size="sm">
                      <Link href={webPathOf(item)}>{kind.action}</Link>
                    </Button>
                  ) : (
                    <p className="type-body-sm text-ink-muted">
                      This kind of decision opens on a screen that isn’t in the web app yet.
                    </p>
                  )
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
