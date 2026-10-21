import type { PriorityClock } from '@lintel/domain';
import { eq, inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { taskDependencies, tasks } from '../../schema';
import type { FileSummaryView } from '../deliverables/file-summary.query';
import { loadTaskSummaries } from '../shared/task-summary.query';
import type { TaskRefView, TaskSummaryView, UserSummaryView } from '../shared/view-types';
import { type BlockerView, loadTaskBlockers } from './blocker.query';
import {
  activeSessionStart,
  type ChecklistItemView,
  loadAttachments,
  loadChecklistItems,
  loadCollaborators,
  loadScheduleChanges,
  type ScheduleChangeView,
} from './task-detail-parts.query';
import { loadTaskRefs } from './task-ref.query';

/** TaskDetail without the viewer-specific parts (transitions and rights come from the application). */
export interface TaskDetailView extends TaskSummaryView {
  readonly description: string | null;
  readonly completionCriteria: string | null;
  readonly baselineDueDate: string | null;
  readonly actualMinutes: number;
  readonly acknowledgedAt: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly parentTask: TaskRefView | null;
  readonly subtasks: TaskRefView[];
  readonly collaborators: UserSummaryView[];
  readonly checklistItems: ChecklistItemView[];
  readonly prerequisites: TaskRefView[];
  readonly dependents: TaskRefView[];
  readonly blockers: BlockerView[];
  readonly attachments: FileSummaryView[];
  readonly scheduleChanges: ScheduleChangeView[];
  readonly activeWorkSessionStartedAt: string | null;
  readonly escalateAfterOverdueDays: number;
}

/** One task with everything the detail screen shows. Access is checked by the caller. */
export async function loadTaskDetail(
  db: DatabaseExecutor,
  taskId: string,
  today: string,
  viewerUserId: string,
  clock?: PriorityClock,
): Promise<TaskDetailView | null> {
  const [summary] = await loadTaskSummaries(db, { where: eq(tasks.id, taskId), today, clock });
  if (!summary) return null;
  const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!row) return null;
  const [
    parent,
    subtasks,
    collaborators,
    checklistItems,
    prerequisites,
    dependents,
    blockers,
    attachments,
    scheduleChanges,
    activeWorkSessionStartedAt,
  ] = await Promise.all([
    row.parentTaskId ? loadTaskRefs(db, eq(tasks.id, row.parentTaskId)) : Promise.resolve([]),
    loadTaskRefs(db, eq(tasks.parentTaskId, taskId)),
    loadCollaborators(db, taskId),
    loadChecklistItems(db, taskId),
    loadTaskRefs(
      db,
      inArray(
        tasks.id,
        db
          .select({ id: taskDependencies.dependsOnTaskId })
          .from(taskDependencies)
          .where(eq(taskDependencies.taskId, taskId)),
      ),
    ),
    loadTaskRefs(
      db,
      inArray(
        tasks.id,
        db
          .select({ id: taskDependencies.taskId })
          .from(taskDependencies)
          .where(eq(taskDependencies.dependsOnTaskId, taskId)),
      ),
    ),
    loadTaskBlockers(db, taskId),
    loadAttachments(db, taskId),
    loadScheduleChanges(db, taskId),
    activeSessionStart(db, taskId, viewerUserId),
  ]);
  return {
    ...summary,
    description: row.description,
    completionCriteria: row.completionCriteria,
    baselineDueDate: row.baselineDueDate,
    actualMinutes: row.actualMinutes,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    parentTask: parent[0] ?? null,
    subtasks,
    collaborators,
    checklistItems,
    prerequisites,
    dependents,
    blockers,
    attachments,
    scheduleChanges,
    activeWorkSessionStartedAt,
    escalateAfterOverdueDays: row.escalateAfterOverdueDays,
  };
}
