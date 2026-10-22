import { buildLeaveBreakdown, type ReportPlan } from '@lintel/application';
import { DEFAULT_WORKING_CALENDAR } from '@lintel/domain';
import { toCalendarDate } from '@lintel/shared';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { SettingsRepository } from '../../repositories/settings.repository';
import { leaveRequests, leaveTypes } from '../../schema';
import { loadUserSummaries } from '../shared/user-summary.query';
import type { ReportSources } from './delivery-report.query';
import { resolveReportScope, scopePeople, teamNamesOf } from './report-scope';

export interface LeaveReportSources extends ReportSources {
  /**
   * Whose leave the viewer may see: null for everyone (the business view),
   * otherwise the people the leave visibility rules allow (themselves, their
   * direct reports and, with `capacity.view_team`, their team).
   */
  readonly audience: readonly string[] | null;
}

/**
 * The people whose leave a report may count, or null for everyone: with a
 * project or manager filter, the members of those projects; narrowed to the
 * team filter and to the viewer's leave audience.
 */
export async function leavePeople(
  db: DatabaseExecutor,
  plan: ReportPlan,
  audience: readonly string[] | null,
): Promise<string[] | null> {
  const scope = await resolveReportScope(db, plan);
  const projectBound = plan.projectId !== null || (plan.scope === 'business' && !scope.allProjects);
  let people: string[] | null = projectBound
    ? await scopePeople(db, { ...scope, allProjects: false }, { activeOnly: false })
    : null;
  if (scope.teamUserIds !== null) {
    const team = new Set(scope.teamUserIds);
    people = (people ?? scope.teamUserIds).filter((id) => team.has(id));
  }
  if (audience !== null) {
    const allowed = new Set(audience);
    people = (people ?? [...audience]).filter((id) => allowed.has(id));
  }
  return people;
}

/**
 * Approved leave (urgent absences included) in the range, by person and
 * leave type, in working days. Formulas: `leave-report.metrics.ts`. Reasons
 * are never part of a report.
 */
export async function loadLeaveReport(
  db: DatabaseExecutor,
  plan: ReportPlan,
  sources: LeaveReportSources,
) {
  const people = await leavePeople(db, plan, sources.audience);
  const rows =
    people !== null && people.length === 0
      ? []
      : await db
          .select({
            userId: leaveRequests.userId,
            leaveTypeId: leaveRequests.leaveTypeId,
            startDate: leaveRequests.startDate,
            endDate: leaveRequests.endDate,
            dayPortion: leaveRequests.dayPortion,
          })
          .from(leaveRequests)
          .where(
            and(
              eq(leaveRequests.status, 'approved'),
              lte(leaveRequests.startDate, plan.range.end),
              gte(leaveRequests.endDate, plan.range.start),
              people ? inArray(leaveRequests.userId, people) : undefined,
            ),
          );
  const userIds = [...new Set(rows.map((row) => row.userId))];
  const calendars = await new SettingsRepository(db).calendarsForUsers(userIds);
  const breakdown = buildLeaveBreakdown(
    rows.map((row) => ({
      ...row,
      startDate: toCalendarDate(row.startDate),
      endDate: toCalendarDate(row.endDate),
    })),
    (userId) => calendars.get(userId) ?? DEFAULT_WORKING_CALENDAR,
    plan.range,
    plan.today,
  );
  const typeIds = [...breakdown.byType.keys()];
  const [types, summaries, teams] = await Promise.all([
    typeIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: leaveTypes.id, name: leaveTypes.name, colorIndex: leaveTypes.colorIndex })
          .from(leaveTypes)
          .where(inArray(leaveTypes.id, typeIds))
          .orderBy(asc(leaveTypes.name)),
    loadUserSummaries(db, [...breakdown.byPerson.keys()]),
    teamNamesOf(db, [...breakdown.byPerson.keys()]),
  ]);
  const entries = [...breakdown.byPersonAndType.values()];
  return {
    generatedAt: sources.now.toISOString(),
    scope: plan.scope,
    range: { start: plan.range.start, end: plan.range.end },
    granularity: plan.granularity,
    studioStartDate: plan.studioStartDate,
    totals: breakdown.totals,
    types: types
      .flatMap((type) => {
        const totals = breakdown.byType.get(type.id);
        return totals ? [{ ...type, ...totals }] : [];
      })
      .sort((left, right) => right.days - left.days || left.name.localeCompare(right.name)),
    byPerson: [...breakdown.byPerson]
      .flatMap(([userId, totals]) => {
        const user = summaries.get(userId);
        if (!user) return [];
        return [
          {
            user,
            team: teams.get(userId)?.name ?? null,
            ...totals,
            byType: entries
              .filter((entry) => entry.userId === userId)
              .map(({ typeId, requests, days, upcomingDays }) => ({
                typeId,
                requests,
                days,
                upcomingDays,
              })),
          },
        ];
      })
      .sort(
        (left, right) =>
          right.days - left.days || left.user.fullName.localeCompare(right.user.fullName),
      ),
  };
}
