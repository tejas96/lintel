import {
  clientKey,
  compareDelayGroups,
  DELAY_KINDS,
  DELAYED_AFTER_HOURS,
  isDelayed,
  RECURRING_DELAY_COUNT,
  type ReportPlan,
  reportInstantWindow,
  slowestWaits,
  summarizeDelayGroup,
  summarizeDelays,
} from '@lintel/application';
import { asc, inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { projects } from '../../schema';
import {
  clientSignoffFacts,
  clientWaitFacts,
  internalReviewFacts,
  type NamedDelayFact,
} from './delay-facts';
import type { ReportSources } from './delivery-report.query';
import { resolveReportScope } from './report-scope';

const SLOWEST_LIMIT = 8;

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    const list = groups.get(value);
    if (list) list.push(item);
    else groups.set(value, [item]);
  }
  return groups;
}

/**
 * Recurring approval delays: client sign-offs, client waits and internal
 * reviews on the scoped projects, by client and by project, with what is
 * waiting now. Formulas: `approval-delay.metrics.ts` (elapsed clock hours).
 */
export async function loadDelaysReport(
  db: DatabaseExecutor,
  plan: ReportPlan,
  sources: ReportSources,
) {
  const scope = await resolveReportScope(db, plan);
  const window = reportInstantWindow(plan.range, sources.timeZone);
  const [signoffs, waits, reviews] = await Promise.all([
    clientSignoffFacts(db, scope.projectIds, window, sources),
    clientWaitFacts(db, scope.projectIds, window),
    internalReviewFacts(db, scope.projectIds, window),
  ]);
  const facts: NamedDelayFact[] = [...signoffs, ...waits, ...reviews];
  const projectIds = [...new Set(facts.map((fact) => fact.projectId))];
  // Oldest project first, so a client is shown with the first spelling of its name.
  const projectRows =
    projectIds.length === 0
      ? []
      : await db
          .select({
            id: projects.id,
            reference: projects.reference,
            name: projects.name,
            colorIndex: projects.colorIndex,
            clientName: projects.clientName,
          })
          .from(projects)
          .where(inArray(projects.id, projectIds))
          .orderBy(asc(projects.createdAt), asc(projects.reference));
  const projectById = new Map(projectRows.map((row) => [row.id, row]));
  const factsByProject = groupBy(facts, (fact) => fact.projectId);
  const clients = groupBy(projectRows, (row) => clientKey(row.clientName));
  const ref = (row: (typeof projectRows)[number]) => ({
    id: row.id,
    reference: row.reference,
    name: row.name,
    colorIndex: row.colorIndex,
  });
  const now = sources.now;
  return {
    generatedAt: now.toISOString(),
    scope: plan.scope,
    range: { start: plan.range.start, end: plan.range.end },
    granularity: plan.granularity,
    delayedAfterHours: DELAYED_AFTER_HOURS,
    recurringAfter: RECURRING_DELAY_COUNT,
    kinds: DELAY_KINDS.map((kind) => ({
      kind,
      ...summarizeDelays(
        facts.filter((fact) => fact.kind === kind),
        window,
        now,
      ),
    })),
    byClient: [...clients.values()]
      .flatMap((rows) => {
        const first = rows[0];
        if (!first) return [];
        const own = rows.flatMap((row) => factsByProject.get(row.id) ?? []);
        const group = summarizeDelayGroup(own, window, now);
        return [{ client: first.clientName.trim(), projects: rows.length, ...group }];
      })
      .sort(
        (left, right) => compareDelayGroups(left, right) || left.client.localeCompare(right.client),
      ),
    byProject: projectRows
      .map((row) => ({
        project: ref(row),
        client: row.clientName.trim(),
        ...summarizeDelayGroup(factsByProject.get(row.id) ?? [], window, now),
      }))
      .sort(
        (left, right) =>
          compareDelayGroups(left, right) ||
          left.project.reference.localeCompare(right.project.reference),
      ),
    slowest: slowestWaits(facts, window, now, SLOWEST_LIMIT).flatMap(({ fact, hours }) => {
      const project = projectById.get(fact.projectId);
      if (!project || !fact.resolvedAt) return [];
      return [
        {
          kind: fact.kind,
          recordId: fact.recordId,
          project: ref(project),
          title: fact.title,
          context: fact.context,
          readyAt: fact.readyAt.toISOString(),
          resolvedAt: fact.resolvedAt.toISOString(),
          hours,
          delayed: isDelayed(hours),
        },
      ];
    }),
  };
}
