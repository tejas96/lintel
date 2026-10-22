import {
  buildDeliveryBreakdown,
  type DeliveryFact,
  EMPTY_TALLY,
  type ReportPlan,
  reportInstantWindow,
} from '@lintel/application';
import { calendarDateInTimeZone, toCalendarDate } from '@lintel/shared';
import { and, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { milestones, projects, tasks } from '../../schema';
import { loadUserSummaries } from '../shared/user-summary.query';
import { type ReportScope, resolveReportScope, teamNamesOf } from './report-scope';

export interface ReportSources {
  readonly timeZone: string;
  readonly now: Date;
}

/** Done tasks completed in the range, or open tasks due in the range before today. */
async function deliveryFacts(
  db: DatabaseExecutor,
  plan: ReportPlan,
  scope: ReportScope,
  timeZone: string,
): Promise<DeliveryFact[]> {
  if (scope.projectIds.length === 0) return [];
  const window = reportInstantWindow(plan.range, timeZone);
  const openDue = (column: typeof tasks.dueDate | typeof milestones.dueDate) =>
    and(gte(column, plan.range.start), lte(column, plan.range.end), lt(column, plan.today));
  const taskRows = await db
    .select({
      projectId: tasks.projectId,
      ownerUserId: tasks.ownerUserId,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
      status: tasks.status,
    })
    .from(tasks)
    .where(
      and(
        inArray(tasks.projectId, scope.projectIds),
        isNull(tasks.archivedAt),
        isNotNull(tasks.dueDate),
        ne(tasks.status, 'cancelled'),
        scope.teamUserIds ? inArray(tasks.ownerUserId, scope.teamUserIds) : undefined,
        or(
          and(
            eq(tasks.status, 'done'),
            gte(tasks.completedAt, window.from),
            lt(tasks.completedAt, window.to),
          ),
          and(ne(tasks.status, 'done'), openDue(tasks.dueDate)),
        ),
      ),
    );
  const milestoneRows = await db
    .select({
      projectId: milestones.projectId,
      dueDate: milestones.dueDate,
      completedAt: milestones.completedAt,
      status: milestones.status,
    })
    .from(milestones)
    .where(
      and(
        inArray(milestones.projectId, scope.projectIds),
        or(
          and(
            eq(milestones.status, 'completed'),
            gte(milestones.completedAt, window.from),
            lt(milestones.completedAt, window.to),
          ),
          and(eq(milestones.status, 'pending'), openDue(milestones.dueDate)),
        ),
      ),
    );
  const completedOn = (status: string, done: string, at: Date | null) =>
    status === done && at ? calendarDateInTimeZone(at, timeZone) : null;
  return [
    ...taskRows.flatMap((row): DeliveryFact[] =>
      row.dueDate
        ? [
            {
              kind: 'task',
              projectId: row.projectId,
              ownerUserId: row.ownerUserId,
              dueDate: toCalendarDate(row.dueDate),
              completedOn: completedOn(row.status, 'done', row.completedAt),
            },
          ]
        : [],
    ),
    ...milestoneRows.map(
      (row): DeliveryFact => ({
        kind: 'milestone',
        projectId: row.projectId,
        ownerUserId: null,
        dueDate: toCalendarDate(row.dueDate),
        completedOn: completedOn(row.status, 'completed', row.completedAt),
      }),
    ),
  ];
}

const rateOrder = (rate: number | null) => (rate === null ? 2 : rate);

/**
 * Delivery reliability: on-time and late completions, plus open overdue work,
 * for the scoped projects. Formulas: `delivery-report.metrics.ts` (application).
 */
export async function loadDeliveryReport(
  db: DatabaseExecutor,
  plan: ReportPlan,
  sources: ReportSources,
) {
  const scope = await resolveReportScope(db, plan);
  const breakdown = buildDeliveryBreakdown(
    await deliveryFacts(db, plan, scope, sources.timeZone),
    plan,
  );
  const projectIds = [...breakdown.byProject.keys()];
  const projectRows =
    projectIds.length === 0
      ? []
      : await db
          .select({
            id: projects.id,
            reference: projects.reference,
            name: projects.name,
            colorIndex: projects.colorIndex,
            managerUserId: projects.managerUserId,
          })
          .from(projects)
          .where(inArray(projects.id, projectIds));
  const ownerIds = [...breakdown.byOwner.keys()];
  const [people, teams] = await Promise.all([
    loadUserSummaries(db, [...ownerIds, ...projectRows.map((row) => row.managerUserId)]),
    teamNamesOf(db, ownerIds),
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
      tasks: breakdown.byPeriod[index]?.tasks ?? EMPTY_TALLY,
      milestones: breakdown.byPeriod[index]?.milestones ?? EMPTY_TALLY,
    })),
    byProject: projectRows
      .flatMap((row) => {
        const manager = people.get(row.managerUserId);
        const tallies = breakdown.byProject.get(row.id);
        if (!manager || !tallies) return [];
        const { managerUserId: _manager, ...project } = row;
        return [{ project, manager, ...tallies }];
      })
      .sort(
        (left, right) =>
          rateOrder(left.tasks.onTimeRate) - rateOrder(right.tasks.onTimeRate) ||
          left.project.reference.localeCompare(right.project.reference),
      ),
    byPerson: ownerIds
      .flatMap((userId) => {
        const user = people.get(userId);
        const tasksTally = breakdown.byOwner.get(userId);
        if (!user || !tasksTally) return [];
        return [{ user, team: teams.get(userId)?.name ?? null, tasks: tasksTally }];
      })
      .sort((left, right) => left.user.fullName.localeCompare(right.user.fullName)),
  };
}
