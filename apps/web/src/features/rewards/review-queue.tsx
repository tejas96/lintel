'use client';

import {
  Button,
  EmptyState,
  ErrorState,
  SegmentedControl,
  Skeleton,
  SkeletonGroup,
} from '@lintel/design-system/web';
import { useState } from 'react';
import { StaleVersionNotice, useStaleVersion } from '@/features/common/stale-version-notice';
import { useSession } from '@/features/session/session-provider';
import { describeError } from '@/lib/api/describe-error';
import { DecideRewardForm } from './decide-reward-form';
import { EvaluationCard } from './evaluation-card';
import { type ReviewFilter, useDecideReward, useReviewQueue } from './use-rewards';

const FILTERS = [
  { value: 'pending_review', label: 'Waiting' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Not approved' },
  { value: 'ineligible', label: 'Not eligible' },
] as const;

const EMPTY: Readonly<Record<ReviewFilter, { title: string; description: string }>> = {
  pending_review: {
    title: 'Nothing waiting for review',
    description: 'When an evaluation meets every criterion, it waits here for your decision.',
  },
  approved: { title: 'No approved rewards', description: 'Approved rewards will be listed here.' },
  rejected: { title: 'Nothing declined', description: 'Rewards you decline will be listed here.' },
  ineligible: {
    title: 'Nobody missed out',
    description: 'Evaluations that did not meet every criterion are kept here as a record.',
  },
};

/** Evaluations that met every criterion, waiting for a person to approve or decline them. */
export function ReviewQueue() {
  const { can } = useSession();
  const [filter, setFilter] = useState<ReviewFilter>('pending_review');
  const [page, setPage] = useState(1);
  const queue = useReviewQueue(filter, page, can('rewards.decide'));
  const staleness = useStaleVersion();
  const decide = useDecideReward(staleness.catchStale);
  const data = queue.data;

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl
        label="Which evaluations"
        value={filter}
        onValueChange={(next) => {
          setFilter(next);
          setPage(1);
        }}
        options={FILTERS}
        size="sm"
        className="self-start"
      />
      <StaleVersionNotice
        show={staleness.stale}
        refreshing={queue.isFetching}
        message="Someone else decided one of these while you were looking. Refresh to see where each one stands."
        onRefresh={() => void queue.refetch().then(staleness.clear)}
      />
      {queue.isPending && (
        <SkeletonGroup label="Loading evaluations" className="flex flex-col gap-3">
          <Skeleton className="h-80 rounded-lg" />
        </SkeletonGroup>
      )}
      {queue.isError && !data && (
        <ErrorState
          {...describeError(queue.error, { resource: 'collection' })}
          onRetry={() => queue.refetch()}
        />
      )}
      {data && data.items.length === 0 && (
        <EmptyState drawing="lamp" size="section" {...EMPTY[filter]} />
      )}
      {data && data.items.length > 0 && (
        <ul
          className={
            queue.isPlaceholderData ? 'flex flex-col gap-4 opacity-60' : 'flex flex-col gap-4'
          }
        >
          {data.items.map((evaluation, index) => (
            <EvaluationCard key={evaluation.id} evaluation={evaluation} index={index} showSubject>
              {evaluation.status === 'pending_review' && (
                <DecideRewardForm
                  key={evaluation.version}
                  evaluation={evaluation}
                  mutation={decide}
                  blocked={staleness.stale}
                />
              )}
            </EvaluationCard>
          ))}
        </ul>
      )}
      {data && data.totalPages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Newer
          </Button>
          <span className="type-body-sm text-ink-muted">
            Page {data.page} of {data.totalPages}
          </span>
          <Button size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
            Older
          </Button>
        </nav>
      )}
    </div>
  );
}
