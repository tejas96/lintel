'use client';

import { SegmentedControl } from '@lintel/design-system/web';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/features/session/session-provider';
import { ChallengeReviewQueue } from './challenge-review-queue';
import { MilestoneReviewQueue } from './milestone-review-queue';
import { ReviewQueue } from './review-queue';
import { useChallengeQueue, useMilestoneRewardQueue } from './use-reward-records';
import { useReviewQueue } from './use-rewards';

const KINDS = ['periods', 'milestones', 'challenges'] as const;
type ReviewKind = (typeof KINDS)[number];

const isKind = (value: string | null): value is ReviewKind =>
  value !== null && (KINDS as readonly string[]).includes(value);

/** "Challenges · 2" when something waits; the plain word otherwise. */
const counted = (label: string, waiting: number | undefined) =>
  waiting ? `${label} · ${waiting}` : label;

/**
 * Everything a reward reviewer decides, in three queues: periodic
 * evaluations, milestone rewards and challenges. The open queue is kept in
 * the URL (`?kind=`), so links from notifications and approvals land on it.
 */
export function RewardReview() {
  const { can } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get('kind');
  const kind: ReviewKind = isKind(requested) ? requested : 'periods';
  const enabled = can('rewards.decide');
  const periods = useReviewQueue('pending_review', 1, enabled);
  const milestones = useMilestoneRewardQueue('pending_review', enabled);
  const challenges = useChallengeQueue('open', enabled);
  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        label="What to review"
        value={kind}
        onValueChange={(next) => router.replace(`${pathname}?kind=${next}`, { scroll: false })}
        options={[
          { value: 'periods', label: counted('Monthly and quarterly', periods.data?.totalItems) },
          { value: 'milestones', label: counted('Milestones', milestones.data?.totalItems) },
          { value: 'challenges', label: counted('Challenges', challenges.data?.totalItems) },
        ]}
        className="self-start max-sm:self-stretch"
      />
      {kind === 'periods' && <ReviewQueue />}
      {kind === 'milestones' && <MilestoneReviewQueue />}
      {kind === 'challenges' && <ChallengeReviewQueue />}
    </div>
  );
}
