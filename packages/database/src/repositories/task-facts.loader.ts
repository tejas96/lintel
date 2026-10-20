import type { ProjectReferences, TaskDecisionInputs } from '@lintel/application';
import { and, count, eq, inArray, isNull } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import {
  deliverables,
  milestones,
  projectStages,
  taskBlockers,
  taskChecklistItems,
  taskCollaborators,
  taskDependencies,
  tasks,
} from '../schema';

/**
 * The raw facts the transition rules need. Queries run one after another:
 * inside a transaction they share a single connection.
 */
export async function loadTaskDecisionInputs(
  db: DatabaseExecutor,
  taskId: string,
): Promise<TaskDecisionInputs> {
  const collaborators = await db
    .select({ userId: taskCollaborators.userId })
    .from(taskCollaborators)
    .where(eq(taskCollaborators.taskId, taskId));
  const edges = await db
    .select({ taskId: taskDependencies.taskId, dependsOnTaskId: taskDependencies.dependsOnTaskId })
    .from(taskDependencies)
    .where(eq(taskDependencies.taskId, taskId));
  const checklist = await db
    .select({
      isRequired: taskChecklistItems.isRequired,
      completedAt: taskChecklistItems.completedAt,
    })
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.taskId, taskId));
  const taskDeliverables = await db
    .select({
      name: deliverables.name,
      isRequired: deliverables.isRequired,
      status: deliverables.status,
      currentVersionNumber: deliverables.currentVersionNumber,
    })
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId));
  const [blockers] = await db
    .select({ open: count() })
    .from(taskBlockers)
    .where(and(eq(taskBlockers.taskId, taskId), isNull(taskBlockers.resolvedAt)));
  const prerequisiteIds = edges.map((edge) => edge.dependsOnTaskId);
  const prerequisites =
    prerequisiteIds.length === 0
      ? []
      : await db
          .select({ id: tasks.id, title: tasks.title, status: tasks.status })
          .from(tasks)
          .where(inArray(tasks.id, prerequisiteIds));
  return {
    collaboratorUserIds: collaborators.map((row) => row.userId),
    prerequisiteEdges: edges,
    prerequisites,
    checklist: checklist.map((item) => ({
      isRequired: item.isRequired,
      completed: item.completedAt !== null,
    })),
    deliverables: taskDeliverables,
    openBlockerCount: blockers?.open ?? 0,
  };
}

async function exists(query: Promise<unknown[]> | null): Promise<boolean> {
  return query === null ? false : (await query).length > 0;
}

export async function referencesInProject(
  db: DatabaseExecutor,
  projectId: string,
  references: ProjectReferences,
): Promise<{ stage: boolean; milestone: boolean; task: boolean }> {
  const { stageId, milestoneId, taskId } = references;
  const stage = await exists(
    stageId
      ? db
          .select({ id: projectStages.id })
          .from(projectStages)
          .where(and(eq(projectStages.id, stageId), eq(projectStages.projectId, projectId)))
      : null,
  );
  const milestone = await exists(
    milestoneId
      ? db
          .select({ id: milestones.id })
          .from(milestones)
          .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, projectId)))
      : null,
  );
  const task = await exists(
    taskId
      ? db
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(eq(tasks.id, taskId), eq(tasks.projectId, projectId), isNull(tasks.archivedAt)),
          )
      : null,
  );
  return { stage, milestone, task };
}
