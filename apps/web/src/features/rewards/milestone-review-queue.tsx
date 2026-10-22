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
import { todayIn } from '@/lib/format/dates';
import { DecideRewardForm } from './decide-reward-form';
import { MilestoneRewardCard } from './milestone-reward-card';
import { RecordChallenges } from './record-challenges';
import { shareTitle } from './reward-record-presentation';
import {
  type ShareFilter,
  useDecideMilestoneReward,
  useMilestoneRewardQueue,
} from './use-reward-records';

const FILTERS = [
  { value: 'pending_review', label: 'Waiting' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Not approved' },
] as const;

const EMPTY: Readonly<Record<ShareFilter, { title: string; description: string }>> = {
  pending_review: {
    title: 'No milestone rewards waiting',
    description:
      'When a milestone with a reward is completed, each person’s share is checked against its conditions and waits here for your decision.',
  },
  approved: {
    title: 'No approved milestone rewards',
    description: 'Approved ones will be listed here.',
  },
  rejected: {
    title: 'Nothing declined',
    description: 'Milestone rewards you decline will be listed here.',
  },
};

/**
 * Milestone rewards per person after completion: the rules' findings and a
 * recommendation, never a decision. The reviewer approves (optionally with
 * a different amount, explained) or declines, always with a note.
 */
export function MilestoneReviewQueue() {
  const { user, can } = useSession();
  const today = todayIn(user.timeZone);
  const [filter, setFilter] = useState<ShareFilter>('pending_review');
  const queue = useMilestoneRewardQueue(filter, can('rewards.decide'));
  const staleness = useStaleVersion();
  const decide = useDecideMilestoneReward(staleness.catchStale);
  const items = queue.data?.items ?? [];
  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl
        label="Which milestone rewards"
        value={filter}
        onValueChange={setFilter}
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
        <SkeletonGroup label="Loading milestone rewards" className="flex flex-col gap-3">
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
          {items.map((share, index) => (
            <MilestoneRewardCard
              key={share.id}
              share={share}
              today={today}
              index={index}
              showSubject
            >
              {share.status === 'pending_review' && share.user?.id === user.id && (
                <p className="border-t border-hairline pt-4 type-body-sm text-ink-muted">
                  This is your own reward, so someone else decides it.
                </p>
              )}
              {share.status === 'pending_review' && share.user?.id !== user.id && (
                <>
                  <p className="type-body-sm text-ink-muted">
                    {share.recommendation === 'grant'
                      ? 'Recommended: every condition was met.'
                      : 'Not recommended: at least one condition was not met. You can still approve it, with a note.'}
                  </p>
                  <DecideRewardForm
                    key={share.version}
                    amountMinor={share.shareAmountMinor}
                    pool={
                      share.pool && share.totalAmountMinor !== null
                        ? {
                            amountMinor: share.totalAmountMinor,
                            othersMinor: share.pool.othersMinor,
                          }
                        : null
                    }
                    currency={share.currency}
                    busy={decide.isPending && decide.variables?.share.id === share.id}
                    blocked={staleness.stale}
                    onDecide={(input, onFailure) =>
                      decide.mutate({ share, ...input }, { onError: onFailure })
                    }
                  />
                </>
              )}
              <RecordChallenges
                recordKind="milestone"
                recordId={share.id}
                title={shareTitle(share)}
                currency={share.currency}
                challenges={share.challenges}
                challengeable={share.challengeable}
                offerChallenge={false}
              />
            </MilestoneRewardCard>
          ))}
        </ul>
      )}
    </div>
  );
}
