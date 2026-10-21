import { addDays, type CalendarDate } from '@lintel/shared';
import { and, asc, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import {
  deliverables,
  deliverableVersions,
  priorityConflicts,
  projects,
  tasks,
} from '../../schema';
import type { ProjectRefView } from '../shared/view-types';

/** An approval item before people are resolved to summaries. */
export interface ApprovalDraft {
  readonly type:
    | 'deliverable_review'
    | 'task_review'
    | 'leave_request'
    | 'scope_change'
    | 'reward_review'
    | 'priority_conflict'
    | 'reassignment_request';
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly requestedByUserId: string | null;
  readonly requestedAt: Date;
  readonly project: ProjectRefView | null;
  readonly linkPath: string;
  readonly urgency: 'normal' | 'high';
}

/** Items waiting longer than this many days are marked urgent. */
export const STALE_APPROVAL_DAYS = 3;
export const SOURCE_LIMIT = 50;

export const projectRefColumns = {
  id: projects.id,
  reference: projects.reference,
  name: projects.name,
  colorIndex: projects.colorIndex,
};

export function isStale(requestedAt: Date, today: CalendarDate): boolean {
  return requestedAt.toISOString().slice(0, 10) <= addDays(today, -STALE_APPROVAL_DAYS);
}

/** Submitted deliverable versions I review, or that sit on projects I manage. */
export async function deliverableReviews(
  db: DatabaseExecutor,
  userId: string,
  today: CalendarDate,
): Promise<ApprovalDraft[]> {
  const rows = await db
    .select({
      deliverableId: deliverables.id,
      name: deliverables.name,
      versionNumber: deliverableVersions.versionNumber,
      submittedBy: deliverableVersions.submittedByUserId,
      submittedAt: deliverableVersions.submittedAt,
      taskDueDate: tasks.dueDate,
      project: projectRefColumns,
    })
    .from(deliverableVersions)
    .innerJoin(deliverables, eq(deliverables.id, deliverableVersions.deliverableId))
    .innerJoin(projects, eq(projects.id, deliverables.projectId))
    .leftJoin(tasks, eq(tasks.id, deliverables.taskId))
    .where(
      and(
        eq(deliverableVersions.decision, 'pending'),
        eq(deliverables.status, 'in_review'),
        ne(deliverableVersions.submittedByUserId, userId),
        or(eq(deliverables.reviewerUserId, userId), eq(projects.managerUserId, userId)),
      ),
    )
    .orderBy(asc(deliverableVersions.submittedAt))
    .limit(SOURCE_LIMIT);
  return rows.map((row) => ({
    type: 'deliverable_review',
    id: row.deliverableId,
    title: row.name,
    subtitle: `Version ${row.versionNumber} · ${row.project.name}`,
    requestedByUserId: row.submittedBy,
    requestedAt: row.submittedAt,
    project: row.project,
    linkPath: `/deliverables/${row.deliverableId}`,
    urgency:
      (row.taskDueDate !== null && row.taskDueDate <= today) || isStale(row.submittedAt, today)
        ? 'high'
        : 'normal',
  }));
}

/** Tasks in review where I am the reviewer. */
export async function taskReviews(
  db: DatabaseExecutor,
  userId: string,
  today: CalendarDate,
): Promise<ApprovalDraft[]> {
  const rows = await db
    .select({ task: tasks, project: projectRefColumns })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(
        eq(tasks.status, 'in_review'),
        eq(tasks.reviewerUserId, userId),
        isNull(tasks.archivedAt),
      ),
    )
    .orderBy(asc(tasks.dueDate))
    .limit(SOURCE_LIMIT);
  return rows.map(({ task, project }) => ({
    type: 'task_review',
    id: task.id,
    title: task.title,
    subtitle: `${project.reference} · #${task.number}${task.dueDate ? ` · due ${task.dueDate}` : ''}`,
    requestedByUserId: task.ownerUserId,
    requestedAt: task.submittedAt ?? task.updatedAt,
    project,
    linkPath: `/tasks/${task.id}`,
    urgency:
      task.priority === 'urgent' || (task.dueDate !== null && task.dueDate <= today)
        ? 'high'
        : 'normal',
  }));
}

/** Open priority conflicts that involve a task on a project I manage. */
export async function priorityConflictReviews(
  db: DatabaseExecutor,
  userId: string,
): Promise<ApprovalDraft[]> {
  const managedTasks = db
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(projects.managerUserId, userId));
  const conflicts = await db
    .select()
    .from(priorityConflicts)
    .where(eq(priorityConflicts.status, 'open'))
    .orderBy(asc(priorityConflicts.createdAt))
    .limit(SOURCE_LIMIT);
  const taskIds = [...new Set(conflicts.flatMap((conflict) => conflict.taskIds))];
  if (taskIds.length === 0) return [];
  const mine = await db
    .select({ id: tasks.id, project: projectRefColumns })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(inArray(tasks.id, taskIds), inArray(tasks.id, managedTasks)));
  return conflicts.flatMap((conflict) => {
    const first = mine.find((task) => conflict.taskIds.includes(task.id));
    if (!first) return [];
    return [
      {
        type: 'priority_conflict' as const,
        id: conflict.id,
        title: 'Priority conflict',
        subtitle: conflict.note.length > 140 ? `${conflict.note.slice(0, 137)}…` : conflict.note,
        requestedByUserId: conflict.raisedByUserId,
        requestedAt: conflict.createdAt,
        project: first.project,
        linkPath: `/tasks/${first.id}`,
        urgency: 'high' as const,
      },
    ];
  });
}
