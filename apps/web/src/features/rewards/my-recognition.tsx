'use client';

import { EmptyState, ErrorState, Skeleton, SkeletonGroup } from '@lintel/design-system/web';
import { describeError } from '@/lib/api/describe-error';
import { EvaluationCard } from './evaluation-card';
import { useMyEvaluations } from './use-rewards';

/** The person's own evaluations, newest period first, each with its evidence. */
export function MyRecognition() {
  const evaluations = useMyEvaluations();
  const items = [...(evaluations.data?.items ?? [])].sort((left, right) =>
    right.periodStart.localeCompare(left.periodStart),
  );
  if (evaluations.isPending) {
    return (
      <SkeletonGroup label="Loading your recognition" className="flex flex-col gap-3">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </SkeletonGroup>
    );
  }
  if (evaluations.isError) {
    return (
      <ErrorState
        {...describeError(evaluations.error, { resource: 'collection' })}
        onRetry={() => evaluations.refetch()}
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        drawing="lamp"
        title="Nothing evaluated yet"
        description="After each month or quarter, your delivered work is checked against the studio’s reward policies. Your results will appear here."
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl type-body-sm text-ink-muted">
        Every criterion must be met, and a manager reviews each result before it is approved.
        Amounts are visible only to you and the people who decide rewards.
      </p>
      <ul className="flex flex-col gap-4">
        {items.map((evaluation, index) => (
          <EvaluationCard key={evaluation.id} evaluation={evaluation} index={index} />
        ))}
      </ul>
    </div>
  );
}
