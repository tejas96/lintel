import { type CommandCenterPlan, RISK_CARD_LIMIT } from '@lintel/application';
import type { DatabaseExecutor } from '../../client';
import { resolveCommandCenterScope } from '../operations/command-center/command-center-scope';
import type { UtilisationSource } from '../operations/command-center/command-center-team';
import { deadlinesNextDays, highlightsInPeriod, interventionsNeeded } from './briefing-lists.query';
import { loadBusinessHealth } from './business-health.query';
import { loadRiskCards, riskContextFor } from './risk-cards.query';

export interface BriefingSources {
  readonly timeZone: string;
  readonly utilisation: UtilisationSource;
  readonly now: Date;
}

/**
 * The command center briefing for the plan's scope and filters: the business
 * health score (with contributors and trend), risk cards for the scoped live
 * projects, deadlines in the next 7 days, performance highlights in the
 * period and the owner's unresolved escalations. Everything is computed from
 * live records with the documented rules (§15 of the product requirements).
 */
export async function loadCommandCenterBriefing(
  db: DatabaseExecutor,
  plan: CommandCenterPlan,
  sources: BriefingSources,
) {
  const scope = await resolveCommandCenterScope(db, plan);
  const context = await riskContextFor(db, plan.today, sources.now);
  const [health, cards, deadlines, highlights, interventions] = await Promise.all([
    loadBusinessHealth(db, scope, plan, sources.utilisation, sources.now),
    loadRiskCards(db, scope.activeProjectIds, context),
    deadlinesNextDays(db, scope, plan),
    highlightsInPeriod(db, scope, plan, sources.timeZone),
    interventionsNeeded(db, scope, context),
  ]);
  return {
    generatedAt: sources.now.toISOString(),
    range: { start: plan.range.start, end: plan.range.end },
    health,
    riskCards: cards.slice(0, RISK_CARD_LIMIT),
    riskCardCount: cards.length,
    deadlines,
    highlights,
    interventions,
  };
}
