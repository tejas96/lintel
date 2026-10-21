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

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "Waiting for you: 2 milestone rewards and 1 challenge." — or null when nothing waits. */
function waitingLine(periods: number, milestones: number, challenges: number): string | null {
  const parts = [
    periods > 0 ? plural(periods, 'periodic evaluation', 'periodic evaluations') : null,
    milestones > 0 ? plural(milestones, 'milestone reward', 'milestone rewards') : null,
    challenges > 0 ? plural(challenges, 'challenge', 'challenges') : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  const last = parts.pop();
  return `Waiting for you: ${parts.length > 0 ? `${parts.join(', ')} and ${last}` : last}.`;
}

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
  const waiting = waitingLine(
    periods.data?.totalItems ?? 0,
    milestones.data?.totalItems ?? 0,
    challenges.data?.totalItems ?? 0,
  );
  return (
    <div className="flex flex-col gap-6">
      {waiting && <p className="type-body text-ink">{waiting}</p>}
      <SegmentedControl
        label="What to review"
        value={kind}
        onValueChange={(next) => router.replace(`${pathname}?kind=${next}`, { scroll: false })}
        options={[
          { value: 'periods', label: 'Periods' },
          { value: 'milestones', label: 'Milestones' },
          { value: 'challenges', label: 'Challenges' },
        ]}
        className="self-start max-sm:self-stretch"
      />
      {kind === 'periods' && <ReviewQueue />}
      {kind === 'milestones' && <MilestoneReviewQueue />}
      {kind === 'challenges' && <ChallengeReviewQueue />}
    </div>
  );
}
