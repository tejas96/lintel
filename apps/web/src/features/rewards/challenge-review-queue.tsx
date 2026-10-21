'use client';

import {
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
import { ChallengeReviewCard } from './challenge-review-card';
import { ResolveChallengeForm } from './resolve-challenge-form';
import { type ChallengeFilter, useChallengeQueue, useResolveChallenge } from './use-reward-records';

const FILTERS = [
  { value: 'open', label: 'Waiting' },
  { value: 'resolved', label: 'Answered' },
] as const;

const EMPTY: Readonly<Record<ChallengeFilter, { title: string; description: string }>> = {
  open: {
    title: 'No challenges waiting',
    description:
      'When someone thinks a reward record about them is wrong, their challenge waits here for your answer.',
  },
  resolved: {
    title: 'No answered challenges',
    description: 'Challenges you answer are kept here.',
  },
};

/** Challenges of reward records: read the reason, check the record, uphold or correct it. */
export function ChallengeReviewQueue() {
  const { user, can } = useSession();
  const [filter, setFilter] = useState<ChallengeFilter>('open');
  const queue = useChallengeQueue(filter, can('rewards.decide'));
  const staleness = useStaleVersion();
  const resolve = useResolveChallenge(staleness.catchStale);
  const items = queue.data?.items ?? [];
  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl
        label="Which challenges"
        value={filter}
        onValueChange={setFilter}
        options={FILTERS}
        size="sm"
        className="self-start"
      />
      <StaleVersionNotice
        show={staleness.stale}
        refreshing={queue.isFetching}
        message="This challenge or its record changed while you were looking. Refresh to see where it stands."
        onRefresh={() => void queue.refetch().then(staleness.clear)}
      />
      {queue.isPending && (
        <SkeletonGroup label="Loading challenges" className="flex flex-col gap-3">
          <Skeleton className="h-80 rounded-lg" />
        </SkeletonGroup>
      )}
      {queue.isError && !queue.data && (
        <ErrorState
          {...describeError(queue.error, { resource: 'collection' })}
          onRetry={() => queue.refetch()}
        />
      )}
      {queue.data && items.length === 0 && (
        <EmptyState drawing="lamp" size="section" {...EMPTY[filter]} />
      )}
      {items.length > 0 && (
        <ul
          className={
            queue.isPlaceholderData ? 'flex flex-col gap-4 opacity-60' : 'flex flex-col gap-4'
          }
        >
          {items.map((challenge, index) => (
            <ChallengeReviewCard key={challenge.id} challenge={challenge} index={index}>
              {challenge.status === 'open' && challenge.raisedBy?.id === user.id && (
                <p className="border-t border-hairline pt-4 type-body-sm text-ink-muted">
                  You raised this, so someone else answers it.
                </p>
              )}
              {challenge.status === 'open' && challenge.raisedBy?.id !== user.id && (
                <ResolveChallengeForm
                  key={challenge.version}
                  challenge={challenge}
                  mutation={resolve}
                  blocked={staleness.stale}
                />
              )}
            </ChallengeReviewCard>
          ))}
        </ul>
      )}
    </div>
  );
}
