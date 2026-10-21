'use client';

import type { MilestoneRewardShare, RewardEvaluation } from '@lintel/api-contracts';
import { EmptyState, ErrorState, Skeleton, SkeletonGroup } from '@lintel/design-system/web';
import type { ReactNode } from 'react';
import { useSession } from '@/features/session/session-provider';
import { describeError } from '@/lib/api/describe-error';
import { todayIn } from '@/lib/format/dates';
import { EarningPolicies } from './earning-rules';
import { EvaluationCard } from './evaluation-card';
import { MilestoneRewardCard } from './milestone-reward-card';
import { RecordChallenges } from './record-challenges';
import { formatPeriod } from './reward-presentation';
import { decidedOn, shareTitle } from './reward-record-presentation';
import { useMyMilestoneRewards } from './use-reward-records';
import { useMyEvaluations, useRewardPolicies } from './use-rewards';

type RecognitionRecord =
  | { readonly kind: 'evaluation'; readonly record: RewardEvaluation; readonly sortKey: string }
  | { readonly kind: 'milestone'; readonly record: MilestoneRewardShare; readonly sortKey: string };

function Section(props: {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <section aria-labelledby={props.id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={props.id} className="type-title-lg text-ink">
          {props.title}
        </h2>
        <p className="max-w-2xl type-body-sm text-ink-muted">{props.description}</p>
      </div>
      {props.children}
    </section>
  );
}

function sorted(records: RecognitionRecord[]): RecognitionRecord[] {
  return records.sort((left, right) => right.sortKey.localeCompare(left.sortKey));
}

/**
 * The person's own recognition: what earns a reward and how it is worked
 * out, what waits for a reviewer, and every decision with its reasons and
 * challenges. Amounts are the person's to see (and the owner's).
 */
export function MyRecognition() {
  const { user } = useSession();
  const today = todayIn(user.timeZone);
  const evaluations = useMyEvaluations();
  const shares = useMyMilestoneRewards();
  const policies = useRewardPolicies();
  const queries = [evaluations, shares, policies];
  if (queries.some((query) => query.isPending)) {
    return (
      <SkeletonGroup label="Loading your recognition" className="flex flex-col gap-3">
        <Skeleton className="h-56 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </SkeletonGroup>
    );
  }
  const failed = queries.find((query) => query.isError);
  if (failed) {
    return (
      <ErrorState
        {...describeError(failed.error, { resource: 'collection' })}
        onRetry={() => queries.forEach((query) => void query.refetch())}
      />
    );
  }
  const records: RecognitionRecord[] = [
    ...(evaluations.data?.items ?? []).map((record) => ({
      kind: 'evaluation' as const,
      record,
      sortKey: decidedOn(record, record.periodEnd),
    })),
    ...(shares.data?.items ?? []).map((record) => ({
      kind: 'milestone' as const,
      record,
      sortKey: decidedOn(record, record.milestone.completedAt ?? record.milestone.dueDate),
    })),
  ];
  const planned = records.filter(
    (item) => item.kind === 'milestone' && item.record.status === 'planned',
  );
  const waiting = sorted(records.filter((item) => item.record.status === 'pending_review'));
  const decided = sorted(
    records.filter((item) => !['planned', 'pending_review'].includes(item.record.status)),
  );
  const activePolicies = (policies.data ?? []).filter((policy) => policy.isActive);
  if (records.length === 0 && activePolicies.length === 0) {
    return (
      <EmptyState
        drawing="lamp"
        title="Nothing to earn yet"
        description="When the studio sets up a reward, or attaches one to a milestone you work on, you will see here what earns it and how it is worked out."
      />
    );
  }
  const card = (item: RecognitionRecord, index: number) =>
    item.kind === 'evaluation' ? (
      <EvaluationCard key={item.record.id} evaluation={item.record} index={index}>
        <RecordChallenges
          recordKind="evaluation"
          recordId={item.record.id}
          title={`${item.record.policy.name} · ${formatPeriod(item.record.periodStart, item.record.periodEnd)}`}
          currency={item.record.currency}
          challenges={item.record.challenges}
          challengeable={item.record.challengeable}
          offerChallenge
        />
      </EvaluationCard>
    ) : (
      <MilestoneRewardCard key={item.record.id} share={item.record} today={today} index={index}>
        <RecordChallenges
          recordKind="milestone"
          recordId={item.record.id}
          title={shareTitle(item.record)}
          currency={item.record.currency}
          challenges={item.record.challenges}
          challengeable={item.record.challengeable}
          offerChallenge
        />
      </MilestoneRewardCard>
    );
  return (
    <div className="flex flex-col gap-10">
      <Section
        id="earning"
        title="What earns a reward"
        description="Every condition of a policy must be met in the same month or quarter. Milestone rewards are checked when the milestone is completed. A person reviews every result; nothing is paid or deducted automatically."
      >
        <EarningPolicies policies={activePolicies} />
        {planned.length > 0 && <ul className="flex flex-col gap-4">{planned.map(card)}</ul>}
      </Section>
      {waiting.length > 0 && (
        <Section
          id="waiting"
          title="Waiting for review"
          description="Checked against the rules and waiting for a reviewer’s decision. The findings below are exactly what the reviewer sees."
        >
          <ul className="flex flex-col gap-4">{waiting.map(card)}</ul>
        </Section>
      )}
      {decided.length > 0 && (
        <Section
          id="decided"
          title="Decided"
          description="Each decision with its reasons. If a record is wrong, challenge it — a reviewer answers with a note, and the full history stays here."
        >
          <ul className="flex flex-col gap-4">{decided.map(card)}</ul>
        </Section>
      )}
    </div>
  );
}
