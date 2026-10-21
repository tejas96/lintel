import { type CommandCenterPlan, type CompletionFact, isoWeekSpanOf } from '@lintel/application';
import { OPEN_TASK_STATUSES } from '@lintel/domain';
import {
  addDays,
  type CalendarDate,
  calendarDateInTimeZone,
  minCalendarDate,
  toCalendarDate,
  zonedTimeToInstant,
} from '@lintel/shared';
import { and, asc, count, desc, eq, exists, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../client';
import { projects, taskBlockers, tasks } from '../../../schema';
import { loadTaskSummaries } from '../../shared/task-summary.query';
import { loadUserSummaries, pickUser } from '../../shared/user-summary.query';
import type { CommandCenterScope } from './command-center-scope';

const SECTION_LIMIT = 10;

export function scopedTasks(scope: CommandCenterScope) {
  return and(
    inArray(tasks.projectId, scope.projectIds),
    isNull(tasks.archivedAt),
    scope.taskOwnerCondition,
  );
}

export const openTask = inArray(tasks.status, [...OPEN_TASK_STATUSES]);
export const hasOpenBlocker = (db: DatabaseExecutor) =>
  exists(
    db
      .select({ id: taskBlockers.id })
      .from(taskBlockers)
      .where(and(eq(taskBlockers.taskId, tasks.id), isNull(taskBlockers.resolvedAt))),
  );

/**
 * Overdue = open with a due date before today. Blocked = open and either in
 * the blocked status or with an unresolved blocker. Due today = open and due
 * today. All counted over non-archived tasks of the scoped projects.
 */
export async function taskCounts(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
  today: CalendarDate,
) {
  if (scope.projectIds.length === 0) return { overdue: 0, blocked: 0, dueToday: 0 };
  const [row] = await db
    .select({
      overdue: sql<number>`count(*) filter (where ${tasks.dueDate} < ${today})::int`,
      dueToday: sql<number>`count(*) filter (where ${tasks.dueDate} = ${today})::int`,
    })
    .from(tasks)
    .where(and(scopedTasks(scope), openTask));
  const [blocked] = await db
    .select({ total: count() })
    .from(tasks)
    .where(and(scopedTasks(scope), openTask, or(eq(tasks.status, 'blocked'), hasOpenBlocker(db))));
  return { overdue: row?.overdue ?? 0, blocked: blocked?.total ?? 0, dueToday: row?.dueToday ?? 0 };
}

/** Done tasks completed from `since` (business timezone) to now, for on-time numbers. */
export async function completionFacts(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
  plan: CommandCenterPlan,
  timeZone: string,
): Promise<CompletionFact[]> {
  if (scope.projectIds.length === 0) return [];
  const trendStart = addDays(isoWeekSpanOf(plan.trendEndsOn).start, -7 * (plan.trendWeeks - 1));
  const since = minCalendarDate(plan.previousRange.start, trendStart);
  const until = addDays(plan.range.end > plan.today ? plan.range.end : plan.today, 1);
  const rows = await db
    .select({ completedAt: tasks.completedAt, dueDate: tasks.dueDate })
    .from(tasks)
    .where(
      and(
        scopedTasks(scope),
        eq(tasks.status, 'done'),
        gte(tasks.completedAt, zonedTimeToInstant(since, '00:00', timeZone)),
        lt(tasks.completedAt, zonedTimeToInstant(until, '00:00', timeZone)),
      ),
    );
  return rows.flatMap((row) =>
    row.completedAt
      ? [
          {
            completedOn: calendarDateInTimeZone(row.completedAt, timeZone),
            dueDate: row.dueDate ? toCalendarDate(row.dueDate) : null,
          },
        ]
      : [],
  );
}

/** Critical today = open, due today, and urgent/high priority or on a high/critical project. */
export function criticalTasksToday(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
  today: CalendarDate,
) {
  if (scope.projectIds.length === 0) return Promise.resolve([]);
  return loadTaskSummaries(db, {
    where: and(
      scopedTasks(scope),
      openTask,
      eq(tasks.dueDate, today),
      or(
        inArray(tasks.priority, ['urgent', 'high']),
        inArray(projects.criticality, ['high', 'critical']),
      ),
    ),
    orderBy: [desc(tasks.priority), asc(tasks.number)],
    limit: SECTION_LIMIT,
    today,
  });
}

/** Unresolved blockers on scoped tasks, oldest first, each with its task. */
export async function openBlockers(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
  today: CalendarDate,
) {
  if (scope.projectIds.length === 0) return [];
  const rows = await db
    .select({ blocker: taskBlockers })
    .from(taskBlockers)
    .innerJoin(tasks, eq(tasks.id, taskBlockers.taskId))
    .where(and(isNull(taskBlockers.resolvedAt), scopedTasks(scope)))
    .orderBy(asc(taskBlockers.raisedAt))
    .limit(SECTION_LIMIT);
  if (rows.length === 0) return [];
  const taskIds = rows.map((row) => row.blocker.taskId);
  const [summaries, people] = await Promise.all([
    loadTaskSummaries(db, { where: inArray(tasks.id, taskIds), today }),
    loadUserSummaries(
      db,
      rows.flatMap(({ blocker }) => [
        blocker.waitingOnUserId,
        blocker.raisedByUserId,
        blocker.resolvedByUserId,
      ]),
    ),
  ]);
  return rows.flatMap(({ blocker }) => {
    const task = summaries.find((summary) => summary.id === blocker.taskId);
    const raisedBy = pickUser(people, blocker.raisedByUserId);
    if (!task || !raisedBy) return [];
    const { projectCriticality: _criticality, ...taskView } = task;
    return [
      {
        id: blocker.id,
        taskId: blocker.taskId,
        category: blocker.category,
        reason: blocker.reason,
        waitingOn: pickUser(people, blocker.waitingOnUserId),
        raisedBy,
        raisedAt: blocker.raisedAt.toISOString(),
        resolvedAt: null,
        resolvedBy: null,
        resolution: null,
        task: taskView,
      },
    ];
  });
}
