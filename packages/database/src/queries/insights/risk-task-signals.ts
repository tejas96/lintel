import type { BlockerCategoryName, RiskTaskFacts } from '@lintel/domain';
import { type CalendarDate, toCalendarDate } from '@lintel/shared';
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import {
  leaveRequests,
  taskBlockers,
  taskDateChangeRequests,
  taskDependencies,
  tasks,
} from '../../schema';

const optionalDate = (value: string | null) => (value ? toCalendarDate(value) : null);

export async function loadTaskRows(db: DatabaseExecutor, projectIds: string[]) {
  return db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      milestoneId: tasks.milestoneId,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      ownerUserId: tasks.ownerUserId,
      reviewerUserId: tasks.reviewerUserId,
      plannedStartDate: tasks.plannedStartDate,
      dueDate: tasks.dueDate,
      escalateAfterOverdueDays: tasks.escalateAfterOverdueDays,
      submittedAt: tasks.submittedAt,
    })
    .from(tasks)
    .where(and(inArray(tasks.projectId, projectIds), isNull(tasks.archivedAt)));
}

export async function loadTaskSignals(
  db: DatabaseExecutor,
  taskIds: string[],
  ownerIds: string[],
  today: CalendarDate,
) {
  if (taskIds.length === 0) return { edges: [], blockers: [], requests: [], leave: [] };
  const [edges, blockers, requests, leave] = await Promise.all([
    db
      .select({
        taskId: taskDependencies.taskId,
        dependsOnTaskId: taskDependencies.dependsOnTaskId,
      })
      .from(taskDependencies)
      .where(inArray(taskDependencies.taskId, taskIds)),
    db
      .select({
        taskId: taskBlockers.taskId,
        category: taskBlockers.category,
        reason: taskBlockers.reason,
        raisedAt: taskBlockers.raisedAt,
        waitingOnUserId: taskBlockers.waitingOnUserId,
      })
      .from(taskBlockers)
      .where(and(inArray(taskBlockers.taskId, taskIds), isNull(taskBlockers.resolvedAt)))
      .orderBy(asc(taskBlockers.raisedAt)),
    db
      .select({
        id: taskDateChangeRequests.id,
        taskId: taskDateChangeRequests.taskId,
        proposedDueDate: taskDateChangeRequests.proposedDueDate,
      })
      .from(taskDateChangeRequests)
      .where(
        and(
          inArray(taskDateChangeRequests.taskId, taskIds),
          eq(taskDateChangeRequests.status, 'open'),
        ),
      ),
    db
      .select({
        id: leaveRequests.id,
        userId: leaveRequests.userId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
      })
      .from(leaveRequests)
      .where(
        and(
          ownerIds.length > 0 ? inArray(leaveRequests.userId, ownerIds) : sql`false`,
          eq(leaveRequests.status, 'approved'),
          gte(leaveRequests.endDate, today),
        ),
      )
      .orderBy(desc(leaveRequests.startDate)),
  ]);
  return { edges, blockers, requests, leave };
}

export type TaskRow = Awaited<ReturnType<typeof loadTaskRows>>[number];
export type Signals = Awaited<ReturnType<typeof loadTaskSignals>>;

export function toRiskTask(row: TaskRow, signals: Signals, today: CalendarDate): RiskTaskFacts {
  const blocker = signals.blockers.find((item) => item.taskId === row.id) ?? null;
  const request = signals.requests.find((item) => item.taskId === row.id) ?? null;
  const until = row.dueDate && row.dueDate > today ? row.dueDate : today;
  const away = row.ownerUserId
    ? signals.leave.find(
        (item) =>
          item.userId === row.ownerUserId && item.startDate <= until && item.endDate >= today,
      )
    : undefined;
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    ownerUserId: row.ownerUserId,
    reviewerUserId: row.reviewerUserId,
    plannedStartDate: optionalDate(row.plannedStartDate),
    dueDate: optionalDate(row.dueDate),
    escalateAfterOverdueDays: row.escalateAfterOverdueDays,
    submittedAt: row.status === 'in_review' ? row.submittedAt : null,
    openBlocker: blocker
      ? {
          category: blocker.category as BlockerCategoryName,
          reason: blocker.reason,
          raisedAt: blocker.raisedAt,
          waitingOnUserId: blocker.waitingOnUserId,
        }
      : null,
    openDateRequest: request
      ? { id: request.id, proposedDueDate: toCalendarDate(request.proposedDueDate) }
      : null,
    ownerAway: away
      ? {
          leaveRequestId: away.id,
          startDate: toCalendarDate(away.startDate),
          endDate: toCalendarDate(away.endDate),
        }
      : null,
  };
}
