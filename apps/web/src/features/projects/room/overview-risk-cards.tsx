'use client';

import { Skeleton, SkeletonGroup } from '@lintel/design-system/web';
import { CheckCircle2 } from 'lucide-react';
import { RiskCard } from '@/features/risks/risk-card';
import { useProjectRisks } from './use-project-room';

/**
 * The control room's risks, each explained: what is happening, the forecast
 * slip in working days, the next action, who acts and when it escalates.
 */
export function OverviewRiskCards({
  projectId,
  today,
}: {
  readonly projectId: string;
  readonly today: string;
}) {
  const risks = useProjectRisks(projectId);
  const cards = risks.data?.cards ?? [];
  return (
    <section aria-labelledby="project-risks-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="project-risks-title" className="type-title-md text-ink">
          What could slip, and what to do
        </h2>
        {risks.data && (
          <p className="type-body-sm text-ink-faint">
            {cards.length === 0
              ? 'Nothing at risk'
              : `${cards.length} ${cards.length === 1 ? 'risk' : 'risks'}, most pressing first`}
          </p>
        )}
      </div>
      {risks.isPending ? (
        <SkeletonGroup label="Loading the risks" className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </SkeletonGroup>
      ) : cards.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-hairline bg-raised px-5 py-4 type-body-sm text-ink-muted">
          <CheckCircle2 aria-hidden className="size-4 text-on-track" />
          No milestone or the delivery date is at risk. Lintel checks again as work moves.
        </p>
      ) : (
        <ul className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {cards.map((card, index) => (
            <RiskCard key={card.key} card={card} today={today} index={index} showProject={false} />
          ))}
        </ul>
      )}
    </section>
  );
}
