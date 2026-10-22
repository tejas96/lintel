import {
  buildEstimateBreakdown,
  EMPTY_ESTIMATE_TALLY,
  type EstimateTally,
  type ReportPlan,
} from '@lintel/application';
import type { DatabaseExecutor } from '../../client';
import { loadUserSummaries } from '../shared/user-summary.query';
import type { ReportSources } from './delivery-report.query';
import { estimateFacts, loadTemplateNaming, mostCommonTitle } from './estimate-facts';
import { resolveReportScope, teamNamesOf } from './report-scope';

export interface EstimatesReportSources extends ReportSources {
  readonly workTrackingEnabled: boolean;
}

/** Groups with something measured come first, then the most tasks. */
const byMeasured = (left: EstimateTally, right: EstimateTally) =>
  right.measured - left.measured ||
  right.measured +
    right.notMeasured +
    right.withoutEstimate -
    (left.measured + left.notMeasured + left.withoutEstimate);

/**
 * Estimate accuracy: estimated against logged effort of the tasks finished in
 * the range on the scoped projects, per person (owner), task type, template
 * and period. Formulas: `estimate-accuracy.metrics.ts` (application).
 */
export async function loadEstimatesReport(
  db: DatabaseExecutor,
  plan: ReportPlan,
  sources: EstimatesReportSources,
) {
  const scope = await resolveReportScope(db, plan);
  const facts = await estimateFacts(db, plan, scope, sources.timeZone);
  const breakdown = buildEstimateBreakdown(facts, plan.periods);
  const ownerIds = [...breakdown.byOwner.keys()];
  const [people, teams, naming] = await Promise.all([
    loadUserSummaries(db, ownerIds),
    teamNamesOf(db, ownerIds),
    loadTemplateNaming(db, facts),
  ]);
  return {
    generatedAt: sources.now.toISOString(),
    scope: plan.scope,
    range: { start: plan.range.start, end: plan.range.end },
    granularity: plan.granularity,
    studioStartDate: plan.studioStartDate,
    totals: breakdown.totals,
    byPeriod: plan.periods.map((period, index) => ({
      start: period.start,
      end: period.end,
      ...(breakdown.byPeriod[index] ?? EMPTY_ESTIMATE_TALLY),
    })),
    byPerson: ownerIds
      .flatMap((userId) => {
        const user = people.get(userId);
        const tally = breakdown.byOwner.get(userId);
        if (!user || !tally) return [];
        return [{ user, team: teams.get(userId)?.name ?? null, ...tally }];
      })
      .sort((left, right) => left.user.fullName.localeCompare(right.user.fullName)),
    byTaskType: [...breakdown.byTaskType]
      .map(([key, tally]) => {
        const sample = facts.find((fact) => fact.taskTypeKey === key);
        const template = sample?.templateId ? naming.templates.get(sample.templateId) : undefined;
        const name =
          key === null
            ? 'Added by hand'
            : (naming.taskTitles.get(key) ??
              mostCommonTitle(facts.filter((fact) => fact.taskTypeKey === key)) ??
              'Task');
        return { key, name, template: key === null ? null : (template ?? null), ...tally };
      })
      .sort(
        (left, right) =>
          Number(left.key === null) - Number(right.key === null) ||
          byMeasured(left, right) ||
          left.name.localeCompare(right.name),
      ),
    byTemplate: [...breakdown.byTemplate]
      .map(([templateId, tally]) => ({
        template:
          templateId === null
            ? null
            : { id: templateId, name: naming.templates.get(templateId) ?? 'Template' },
        ...tally,
      }))
      .sort(
        (left, right) =>
          Number(left.template === null) - Number(right.template === null) ||
          (left.template?.name ?? '').localeCompare(right.template?.name ?? ''),
      ),
    workTrackingEnabled: sources.workTrackingEnabled,
  };
}
