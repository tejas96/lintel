import { and, asc, count, eq, inArray, isNull, type SQL, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import {
  milestones,
  projectStages,
  projects,
  taskBlockers,
  taskChecklistItems,
  tasks,
} from '../../schema';
import { loadUserSummaries, pickUser } from './user-summary.query';
import type { TaskSummaryView } from './view-types';

export interface TaskSummaryQuery {
  readonly where?: SQL | undefined;
  readonly orderBy?: SQL[];
  readonly limit?: number;
  readonly offset?: number;
  /** Business-timezone "today" (YYYY-MM-DD), used for `isOverdue`. */
  readonly today: string;
}

const OPEN_STATUSES = [
  'draft',
  'ready',
  'in_progress',
  'blocked',
  'in_review',
  'changes_requested',
] as const;

/**
 * The one way to build TaskSummary views, shared by work queues, project
 * screens, dashboards and leave impact. Callers pass access filters in `where`.
 */
export async function loadTaskSummaries(
  db: DatabaseExecutor,
  query: TaskSummaryQuery,
): Promise<TaskSummaryView[]> {
  const rows = await db
    .select({
      task: tasks,
      project: {
        id: projects.id,
        reference: projects.reference,
        name: projects.name,
        colorIndex: projects.colorIndex,
        criticality: projects.criticality,
      },
      stage: { id: projectStages.id, name: projectStages.name },
      milestone: { id: milestones.id, name: milestones.name, dueDate: milestones.dueDate },
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(projectStages, eq(projectStages.id, tasks.stageId))
    .leftJoin(milestones, eq(milestones.id, tasks.milestoneId))
    .where(and(isNull(tasks.archivedAt), query.where))
    .orderBy(...(query.orderBy ?? [asc(tasks.dueDate), asc(tasks.number)]))
    .limit(query.limit ?? 200)
    .offset(query.offset ?? 0);
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.task.id);
  const [checklists, blockers, people] = await Promise.all([
    db
      .select({
        taskId: taskChecklistItems.taskId,
        total: count(),
        done: sql<number>`count(${taskChecklistItems.completedAt})::int`,
        requiredRemaining: sql<number>`count(*) filter (where ${taskChecklistItems.isRequired} and ${taskChecklistItems.completedAt} is null)::int`,
      })
      .from(taskChecklistItems)
      .where(inArray(taskChecklistItems.taskId, ids))
      .groupBy(taskChecklistItems.taskId),
    db
      .selectDistinct({ taskId: taskBlockers.taskId })
      .from(taskBlockers)
      .where(and(inArray(taskBlockers.taskId, ids), isNull(taskBlockers.resolvedAt))),
    loadUserSummaries(
      db,
      rows.flatMap((row) => [row.task.ownerUserId, row.task.reviewerUserId]),
    ),
  ]);
  const checklistByTask = new Map(checklists.map((row) => [row.taskId, row]));
  const blocked = new Set(blockers.map((row) => row.taskId));
  return rows.map(({ task, project, stage, milestone }) => {
    const checklist = checklistByTask.get(task.id);
    const isOpen = (OPEN_STATUSES as readonly string[]).includes(task.status);
    return {
      id: task.id,
      number: task.number,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate,
      priority: task.priority,
      project: {
        id: project.id,
        reference: project.reference,
        name: project.name,
        colorIndex: project.colorIndex,
      },
      projectCriticality: project.criticality,
      stage: stage?.id ? { id: stage.id, name: stage.name } : null,
      milestone: milestone?.id
        ? { id: milestone.id, name: milestone.name, dueDate: milestone.dueDate }
        : null,
      owner: pickUser(people, task.ownerUserId),
      reviewer: pickUser(people, task.reviewerUserId),
      plannedStartDate: task.plannedStartDate,
      estimateMinutes: task.estimateMinutes,
      checklist: {
        done: checklist?.done ?? 0,
        total: checklist?.total ?? 0,
        requiredRemaining: checklist?.requiredRemaining ?? 0,
      },
      isOverdue: isOpen && task.dueDate !== null && task.dueDate < query.today,
      hasOpenBlocker: blocked.has(task.id),
      requiresReview: task.requiresReview,
      needsAcknowledgement:
        isOpen &&
        task.requiresAcknowledgement &&
        task.acknowledgedAt === null &&
        task.ownerUserId !== null,
      version: task.version,
    };
  });
}
