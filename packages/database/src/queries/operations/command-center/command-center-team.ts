import {
  type CommandCenterPlan,
  overloadedPeople,
  type PersonSummary,
  presenceToday,
} from '@lintel/application';
import { DEFAULT_WORKING_CALENDAR, leaveDays } from '@lintel/domain';
import { toCalendarDate, zonedTimeToInstant } from '@lintel/shared';
import { and, asc, count, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../client';
import { SettingsRepository } from '../../../repositories/settings.repository';
import { leaveApprovalSteps, leaveRequests, rewardEvaluations } from '../../../schema';
import { loadLeaveRequestViews } from '../../leave/leave-request.view';
import { loadUserSummaries } from '../../shared/user-summary.query';
import type { CommandCenterScope } from './command-center-scope';

/** Capacity rows for people over a span (provided by the application CapacityQuery). */
export type UtilisationSource = (
  userIds: readonly string[],
  span: { start: string; end: string },
) => Promise<readonly { user: PersonSummary; utilization: number }[]>;

/**
 * Headcount = active people in scope. On leave today = approved leave whose
 * working days include today. Available today = working today and not away
 * the whole day. Overloaded = confirmed load above 105% of the availability
 * left this week (today through Sunday).
 */
export async function teamSection(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
  plan: CommandCenterPlan,
  utilisation: UtilisationSource,
) {
  const people = scope.peopleIds;
  if (people.length === 0) {
    return { headcount: 0, availableToday: 0, onLeaveToday: [], overloaded: [] };
  }
  const [calendars, leaveRows, rows] = await Promise.all([
    new SettingsRepository(db).calendarsForUsers(people),
    db
      .select()
      .from(leaveRequests)
      .where(
        and(
          inArray(leaveRequests.userId, people),
          eq(leaveRequests.status, 'approved'),
          lte(leaveRequests.startDate, plan.today),
          gte(leaveRequests.endDate, plan.today),
        ),
      ),
    utilisation(people, plan.remainingWeek),
  ]);
  const facts = people.map((userId) => {
    const calendar = calendars.get(userId) ?? DEFAULT_WORKING_CALENDAR;
    const today = leaveRows
      .filter((row) => row.userId === userId)
      .flatMap((row) =>
        leaveDays(
          {
            startDate: toCalendarDate(row.startDate),
            endDate: toCalendarDate(row.endDate),
            dayPortion: row.dayPortion,
          },
          calendar,
        ),
      )
      .filter((day) => day.date === plan.today);
    const leaveHalfDaysToday = Math.min(
      2,
      today.reduce((total, day) => total + day.halfDayUnits, 0),
    );
    return { userId, calendar, leaveHalfDaysToday };
  });
  const presence = presenceToday(facts, plan.today);
  const summaries = await loadUserSummaries(db, presence.onLeaveUserIds);
  return {
    headcount: people.length,
    availableToday: presence.availableToday,
    onLeaveToday: presence.onLeaveUserIds.flatMap((userId) => {
      const user = summaries.get(userId);
      return user ? [user] : [];
    }),
    overloaded: overloadedPeople(rows).map((row) => ({
      user: row.user,
      utilization: row.utilization,
    })),
  };
}

/**
 * Leave waiting for a decision, soonest first. The business view (owner and
 * administrators) sees the studio's queue; a project manager sees only the
 * requests whose pending step is theirs to decide. Reasons are never shown on
 * the dashboard — they can be personal and live on the access-checked detail page.
 */
export async function leaveAwaitingDecision(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
  plan: CommandCenterPlan,
) {
  const wholeStudio =
    plan.scope === 'business' && !plan.projectId && !plan.managerUserId && !plan.teamId;
  if (!wholeStudio && scope.peopleIds.length === 0) return [];
  const mine =
    plan.scope === 'managed'
      ? db
          .select({ id: leaveApprovalSteps.leaveRequestId })
          .from(leaveApprovalSteps)
          .where(
            and(
              eq(leaveApprovalSteps.approverUserId, plan.viewerUserId),
              eq(leaveApprovalSteps.status, 'pending'),
            ),
          )
      : undefined;
  const views = await loadLeaveRequestViews(db, {
    where: and(
      inArray(leaveRequests.status, ['pending', 'info_requested']),
      wholeStudio ? undefined : inArray(leaveRequests.userId, scope.peopleIds),
      mine ? inArray(leaveRequests.id, mine) : undefined,
    ),
    orderBy: [asc(leaveRequests.startDate)],
    limit: 10,
  });
  return views.map((view) => ({ ...view, reason: null }));
}

/**
 * Pending review = evaluations waiting for a decision. Approved this month =
 * the sum of approved amounts (the adjusted amount when one was set) decided
 * since the first day of this month.
 */
export async function rewardsSummary(
  db: DatabaseExecutor,
  plan: CommandCenterPlan,
  timeZone: string,
  currency: string,
) {
  const monthStart = zonedTimeToInstant(
    toCalendarDate(`${plan.today.slice(0, 7)}-01`),
    '00:00',
    timeZone,
  );
  const [[pending], [approved]] = await Promise.all([
    db
      .select({ total: count() })
      .from(rewardEvaluations)
      .where(eq(rewardEvaluations.status, 'pending_review')),
    db
      .select({
        total: sql<number>`coalesce(sum(coalesce(${rewardEvaluations.adjustedAmountMinor}, ${rewardEvaluations.amountMinor})), 0)::bigint`,
      })
      .from(rewardEvaluations)
      .where(
        and(eq(rewardEvaluations.status, 'approved'), gte(rewardEvaluations.decidedAt, monthStart)),
      ),
  ]);
  return {
    pendingReview: pending?.total ?? 0,
    approvedThisMonthMinor: Number(approved?.total ?? 0),
    currency,
  };
}
