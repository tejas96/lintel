import type {
  BlockerReportRecord,
  CompletedMilestoneRecord,
  CompletedTaskRecord,
} from '@lintel/application';
import { and, eq, gte, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { milestones, taskBlockers, taskChecklistItems, taskCollaborators, tasks } from '../schema';

function group<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const grouped = new Map<K, T[]>();
  for (const row of rows) {
    const list = grouped.get(key(row)) ?? [];
    list.push(row);
    grouped.set(key(row), list);
  }
  return grouped;
}

/** Done tasks completed in [from, to) owned by, or shared with, any of the people. */
export async function loadCompletedTasks(
  db: DatabaseExecutor,
  userIds: readonly string[],
  from: Date,
  to: Date,
): Promise<CompletedTaskRecord[]> {
  if (userIds.length === 0) return [];
  const sharedWith = db
    .select({ taskId: taskCollaborators.taskId })
    .from(taskCollaborators)
    .where(inArray(taskCollaborators.userId, [...userIds]));
  const rows = await db
    .select({
      id: tasks.id,
      ownerUserId: tasks.ownerUserId,
      completedAt: tasks.completedAt,
      dueDate: tasks.dueDate,
      requiresReview: tasks.requiresReview,
      reviewRounds: tasks.reviewRounds,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.status, 'done'),
        isNull(tasks.archivedAt),
        gte(tasks.completedAt, from),
        lt(tasks.completedAt, to),
        or(inArray(tasks.ownerUserId, [...userIds]), inArray(tasks.id, sharedWith)),
      ),
    );
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  // Sequential: this runs inside the evaluation transaction, on one connection.
  const collaborators = await db
    .select({ taskId: taskCollaborators.taskId, userId: taskCollaborators.userId })
    .from(taskCollaborators)
    .where(inArray(taskCollaborators.taskId, ids));
  const checklist = await db
    .select({ taskId: taskChecklistItems.taskId, completedAt: taskChecklistItems.completedAt })
    .from(taskChecklistItems)
    .where(and(inArray(taskChecklistItems.taskId, ids), eq(taskChecklistItems.isRequired, true)));
  const blockers = await db
    .select({
      taskId: taskBlockers.taskId,
      category: taskBlockers.category,
      raisedAt: taskBlockers.raisedAt,
      resolvedAt: taskBlockers.resolvedAt,
    })
    .from(taskBlockers)
    .where(inArray(taskBlockers.taskId, ids));
  const collaboratorsByTask = group(collaborators, (row) => row.taskId);
  const checklistByTask = group(checklist, (row) => row.taskId);
  const blockersByTask = group(blockers, (row) => row.taskId);
  return rows.flatMap((row) =>
    row.completedAt
      ? [
          {
            taskId: row.id,
            ownerUserId: row.ownerUserId,
            collaboratorUserIds: (collaboratorsByTask.get(row.id) ?? []).map((item) => item.userId),
            completedAt: row.completedAt,
            dueDate: row.dueDate,
            requiresReview: row.requiresReview,
            reviewRounds: row.reviewRounds,
            requiredChecklistCompletedAt: (checklistByTask.get(row.id) ?? []).map(
              (item) => item.completedAt,
            ),
            blockers: (blockersByTask.get(row.id) ?? []).map(
              ({ category, raisedAt, resolvedAt }) => ({ category, raisedAt, resolvedAt }),
            ),
          },
        ]
      : [],
  );
}

export async function loadBlockerReports(
  db: DatabaseExecutor,
  userIds: readonly string[],
  from: Date,
  to: Date,
): Promise<BlockerReportRecord[]> {
  if (userIds.length === 0) return [];
  return db
    .select({
      raisedByUserId: taskBlockers.raisedByUserId,
      raisedAt: taskBlockers.raisedAt,
      taskDueDate: tasks.dueDate,
    })
    .from(taskBlockers)
    .innerJoin(tasks, eq(tasks.id, taskBlockers.taskId))
    .where(
      and(
        inArray(taskBlockers.raisedByUserId, [...userIds]),
        gte(taskBlockers.raisedAt, from),
        lt(taskBlockers.raisedAt, to),
      ),
    );
}

export async function loadCompletedMilestones(
  db: DatabaseExecutor,
  from: Date,
  to: Date,
): Promise<CompletedMilestoneRecord[]> {
  const rows = await db
    .select({ id: milestones.id, dueDate: milestones.dueDate, completedAt: milestones.completedAt })
    .from(milestones)
    .where(
      and(
        eq(milestones.status, 'completed'),
        gte(milestones.completedAt, from),
        lt(milestones.completedAt, to),
      ),
    );
  if (rows.length === 0) return [];
  const owners = await db
    .selectDistinct({ milestoneId: tasks.milestoneId, ownerUserId: tasks.ownerUserId })
    .from(tasks)
    .where(
      and(
        inArray(
          tasks.milestoneId,
          rows.map((row) => row.id),
        ),
        isNotNull(tasks.ownerUserId),
      ),
    );
  const ownersByMilestone = group(owners, (row) => row.milestoneId);
  return rows.flatMap((row) =>
    row.completedAt
      ? [
          {
            milestoneId: row.id,
            dueDate: row.dueDate,
            completedAt: row.completedAt,
            taskOwnerUserIds: (ownersByMilestone.get(row.id) ?? []).flatMap((item) =>
              item.ownerUserId ? [item.ownerUserId] : [],
            ),
          },
        ]
      : [],
  );
}
