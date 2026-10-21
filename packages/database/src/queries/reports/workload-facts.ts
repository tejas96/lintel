import {
  type InstantRange,
  type PlannedWorkFact,
  type ReportPlan,
  reportInstantWindow,
} from '@lintel/application';
import { DEFAULT_WORKING_CALENDAR, leaveDays, type WorkingCalendar } from '@lintel/domain';
import { type CalendarDate, calendarDateInTimeZone, toCalendarDate } from '@lintel/shared';
import { and, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, type SQL, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { leaveRequests, tasks, workSessions } from '../../schema';
import type { ReportScope } from './report-scope';

type PlannedTask = PlannedWorkFact & { readonly hasEstimate: boolean };
type LoggedSession = { day: CalendarDate; minutes: number };
type LeaveDay = { date: CalendarDate; halfDayUnits: number };

export interface PersonWorkFacts {
  readonly tasks: PlannedTask[];
  readonly sessions: LoggedSession[];
  readonly approvedLeave: LeaveDay[];
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Scheduled tasks (owner and due date set, not cancelled or archived) touching the range. */
async function plannedTasks(
  db: DatabaseExecutor,
  people: readonly string[],
  range: ReportPlan['range'],
  onScope: SQL | undefined,
): Promise<Map<string, PlannedTask[]>> {
  const rows = await db
    .select({
      ownerUserId: tasks.ownerUserId,
      estimateMinutes: tasks.estimateMinutes,
      plannedStartDate: tasks.plannedStartDate,
      dueDate: tasks.dueDate,
      status: tasks.status,
    })
    .from(tasks)
    .where(
      and(
        inArray(tasks.ownerUserId, [...people]),
        isNull(tasks.archivedAt),
        isNotNull(tasks.dueDate),
        ne(tasks.status, 'cancelled'),
        onScope,
        gte(tasks.dueDate, range.start),
        lte(sql`coalesce(${tasks.plannedStartDate}, ${tasks.dueDate})`, range.end),
      ),
    );
  const byOwner = new Map<string, PlannedTask[]>();
  for (const row of rows) {
    if (!row.ownerUserId || !row.dueDate) continue;
    push(byOwner, row.ownerUserId, {
      estimateMinutes: row.estimateMinutes,
      hasEstimate: row.estimateMinutes !== null,
      plannedStartDate: row.plannedStartDate ? toCalendarDate(row.plannedStartDate) : null,
      dueDate: toCalendarDate(row.dueDate),
      tentative: row.status === 'draft',
    });
  }
  return byOwner;
}

/** Ended work sessions that started in the window, on the business day they started. */
async function loggedSessions(
  db: DatabaseExecutor,
  people: readonly string[],
  window: InstantRange,
  onScope: SQL | undefined,
  timeZone: string,
): Promise<Map<string, LoggedSession[]>> {
  const rows = await db
    .select({
      userId: workSessions.userId,
      startedAt: workSessions.startedAt,
      endedAt: workSessions.endedAt,
    })
    .from(workSessions)
    .innerJoin(tasks, eq(tasks.id, workSessions.taskId))
    .where(
      and(
        inArray(workSessions.userId, [...people]),
        isNotNull(workSessions.endedAt),
        gte(workSessions.startedAt, window.from),
        lt(workSessions.startedAt, window.to),
        onScope,
      ),
    );
  const byPerson = new Map<string, LoggedSession[]>();
  for (const row of rows) {
    if (!row.endedAt) continue;
    push(byPerson, row.userId, {
      day: calendarDateInTimeZone(row.startedAt, timeZone),
      minutes: Math.max(0, (row.endedAt.getTime() - row.startedAt.getTime()) / 60_000),
    });
  }
  return byPerson;
}

/** Approved leave, expanded to the person's working days, inside the range. */
async function approvedLeaveDays(
  db: DatabaseExecutor,
  people: readonly string[],
  range: ReportPlan['range'],
  calendars: ReadonlyMap<string, WorkingCalendar>,
): Promise<Map<string, LeaveDay[]>> {
  const rows = await db
    .select()
    .from(leaveRequests)
    .where(
      and(
        inArray(leaveRequests.userId, [...people]),
        eq(leaveRequests.status, 'approved'),
        lte(leaveRequests.startDate, range.end),
        gte(leaveRequests.endDate, range.start),
      ),
    );
  const byPerson = new Map<string, LeaveDay[]>();
  for (const row of rows) {
    const period = {
      startDate: toCalendarDate(row.startDate),
      endDate: toCalendarDate(row.endDate),
      dayPortion: row.dayPortion,
    };
    const days = leaveDays(period, calendars.get(row.userId) ?? DEFAULT_WORKING_CALENDAR);
    for (const day of days) {
      if (day.date >= range.start && day.date <= range.end) push(byPerson, row.userId, day);
    }
  }
  return byPerson;
}

/**
 * Per person: scheduled tasks touching the range (only the scoped projects
 * unless the report covers every project), ended work sessions started in
 * the range (same project rule), and approved leave days in the range.
 */
export async function loadWorkFacts(
  db: DatabaseExecutor,
  plan: ReportPlan,
  scope: ReportScope,
  people: readonly string[],
  calendars: ReadonlyMap<string, WorkingCalendar>,
  timeZone: string,
): Promise<Map<string, PersonWorkFacts>> {
  if (people.length === 0) return new Map();
  const onScope = scope.allProjects ? undefined : inArray(tasks.projectId, scope.projectIds);
  const window = reportInstantWindow(plan.range, timeZone);
  const [planned, logged, leave] = await Promise.all([
    plannedTasks(db, people, plan.range, onScope),
    loggedSessions(db, people, window, onScope, timeZone),
    approvedLeaveDays(db, people, plan.range, calendars),
  ]);
  return new Map(
    people.map((userId) => [
      userId,
      {
        tasks: planned.get(userId) ?? [],
        sessions: logged.get(userId) ?? [],
        approvedLeave: leave.get(userId) ?? [],
      },
    ]),
  );
}
