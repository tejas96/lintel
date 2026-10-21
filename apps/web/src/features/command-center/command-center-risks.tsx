'use client';

import type { CommandCenterBriefing } from '@lintel/api-contracts';
import { CheckCircle2 } from 'lucide-react';
import { RiskCard } from '@/features/risks/risk-card';

/** The most pressing risks in view, each explained with its next action. */
export function CommandCenterRisks({
  briefing,
  today,
  filtered,
}: {
  readonly briefing: CommandCenterBriefing;
  readonly today: string;
  readonly filtered: boolean;
}) {
  const hidden = briefing.riskCardCount - briefing.riskCards.length;
  return (
    <section aria-labelledby="risks-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="risks-title" className="type-title-md text-ink">
          What could slip, and what to do
        </h2>
        <p className="type-body-sm text-ink-faint">
          {briefing.riskCardCount === 0
            ? 'Nothing at risk'
            : `${briefing.riskCardCount} ${briefing.riskCardCount === 1 ? 'risk' : 'risks'}, most pressing first`}
        </p>
      </div>
      {briefing.riskCards.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-hairline bg-raised px-5 py-4 type-body-sm text-ink-muted">
          <CheckCircle2 aria-hidden className="size-4 text-on-track" />
          {filtered
            ? 'No milestone or delivery date in this view is at risk.'
            : 'No milestone or delivery date is at risk right now.'}
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {briefing.riskCards.map((card, index) => (
            <RiskCard key={card.key} card={card} today={today} index={index} />
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <p className="type-body-sm text-ink-faint">
          {hidden} more in the projects’ control rooms (Projects, then Overview).
        </p>
      )}
    </section>
  );
}
