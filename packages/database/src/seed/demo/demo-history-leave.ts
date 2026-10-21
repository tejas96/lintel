import { type LeaveDay, leaveDays, totalHalfDayUnits } from '@lintel/domain';
import { addDays, type CalendarDate, daysBetween } from '@lintel/shared';
import { eq } from 'drizzle-orm';
import type { Database } from '../../client';
import { leaveApprovalSteps, leaveRequests, leaveTypes, users } from '../../schema';
import type { DemoContext } from './demo-context';
import { DEMO_LEAVE_HISTORY, type DemoLeavePlan } from './demo-history-leave.plan';
import { clockTime, type HistoryClock, plusHours } from './demo-history-time';

const STEP_STATUS = {
  approved: 'approved',
  rejected: 'rejected',
  cancelled: 'skipped',
  pending: 'pending',
} as const;

interface LeaveTimeline {
  readonly start: CalendarDate;
  readonly end: CalendarDate;
  readonly requestedOn: CalendarDate;
  readonly requestedAt: Date;
  /** When the manager decided or the requester withdrew; null while pending. */
  readonly closedAt: Date | null;
}

function timelineOf(plan: DemoLeavePlan, clock: HistoryClock, index: number): LeaveTimeline {
  const start = clock.shift(clock.today, plan.startInWorkingDays);
  const end = plan.workingDays > 1 ? clock.shift(start, plan.workingDays - 1) : start;
  const requestedOn =
    plan.requestedDaysAgo === null
      ? addDays(start, -plan.noticeDays)
      : addDays(clock.today, -plan.requestedDaysAgo);
  const requestedAt = clock.past(clock.at(requestedOn, clockTime(600 + ((index * 53) % 330))));
  const closedAt =
    plan.outcome === 'pending' ? null : clock.past(plusHours(requestedAt, plan.decisionHours));
  return { start, end, requestedOn, requestedAt, closedAt };
}

async function managerOf(db: Database, userId: string): Promise<string> {
  const [row] = await db
    .select({ managerId: users.reportsToUserId })
    .from(users)
    .where(eq(users.id, userId));
  if (!row?.managerId) throw new Error('Every demo leave requester needs a manager.');
  return row.managerId;
}

export interface LeaveHistoryResult {
  readonly requests: number;
  /** Approved days off by person, so logged work avoids them. */
  readonly daysOff: ReadonlyMap<string, ReadonlySet<CalendarDate>>;
}

type LeaveTypeRow = typeof leaveTypes.$inferSelect;

/** One request and its level-1 step, as the request and decide use cases leave them. */
async function writeRequest(
  db: Database,
  plan: DemoLeavePlan,
  people: { userId: string; managerId: string },
  type: LeaveTypeRow,
  when: LeaveTimeline,
  days: readonly LeaveDay[],
): Promise<void> {
  const period = { startDate: when.start, endDate: when.end, dayPortion: plan.portion };
  const decided = plan.outcome === 'approved' || plan.outcome === 'rejected';
  const notice = daysBetween(when.requestedOn, when.start);
  const [request] = await db
    .insert(leaveRequests)
    .values({
      userId: people.userId,
      leaveTypeId: type.id,
      ...period,
      halfDayUnits: totalHalfDayUnits(days),
      reason: plan.reason,
      status: plan.outcome,
      warnings:
        notice < type.minimumNoticeDays
          ? [`Less than ${type.minimumNoticeDays} days of notice was given.`]
          : [],
      decisionNote: plan.note,
      decidedAt: decided ? when.closedAt : null,
      cancelledAt: plan.outcome === 'cancelled' ? when.closedAt : null,
      version: plan.outcome === 'pending' ? 1 : 2,
      createdAt: when.requestedAt,
      updatedAt: when.closedAt ?? when.requestedAt,
    })
    .returning({ id: leaveRequests.id });
  if (!request) throw new Error('Could not store a demo leave request.');
  await db.insert(leaveApprovalSteps).values({
    leaveRequestId: request.id,
    level: 1,
    approverUserId: people.managerId,
    status: STEP_STATUS[plan.outcome],
    decidedByUserId: decided ? people.managerId : null,
    decidedAt: decided ? when.closedAt : null,
    note: decided ? plan.note : null,
  });
}

/**
 * Writes the leave history straight to the tables, shaped like the leave
 * use cases leave them: one level-1 step for the person's manager, the
 * decision on both the request and the step, and notice warnings.
 */
export async function seedLeaveHistory(
  context: DemoContext,
  clock: HistoryClock,
): Promise<LeaveHistoryResult> {
  const db = context.db;
  const types = new Map((await db.select().from(leaveTypes)).map((type) => [type.code, type]));
  const daysOff = new Map<string, Set<CalendarDate>>();
  for (const [index, plan] of DEMO_LEAVE_HISTORY.entries()) {
    const type = types.get(plan.type);
    if (!type) throw new Error(`Leave type "${plan.type}" is missing. Run db:seed first.`);
    const userId = context.personId(plan.person);
    const people = { userId, managerId: await managerOf(db, userId) };
    const when = timelineOf(plan, clock, index);
    const days = leaveDays(
      { startDate: when.start, endDate: when.end, dayPortion: plan.portion },
      clock.calendar,
    );
    await writeRequest(db, plan, people, type, when, days);
    if (plan.outcome !== 'approved') continue;
    const taken = daysOff.get(userId) ?? new Set<CalendarDate>();
    for (const day of days) taken.add(day.date);
    daysOff.set(userId, taken);
  }
  return { requests: DEMO_LEAVE_HISTORY.length, daysOff };
}
