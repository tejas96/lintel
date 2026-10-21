import type { ProjectWorkflowSnapshot } from '@lintel/domain';
import { and, asc, eq, inArray, isNull, ne } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import {
  deliverables,
  milestones,
  projectStages,
  projects,
  taskChecklistItems,
  taskDependencies,
  tasks,
} from '../schema';

function groupBy<T>(rows: readonly T[], key: (row: T) => string, value: (row: T) => string) {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(key(row)) ?? [];
    list.push(value(row));
    map.set(key(row), list);
  }
  return map;
}

/**
 * The project's workflow as a template update sees it: stages, milestones
 * and live tasks with their checklist labels, deliverable names and
 * prerequisites. Queries run one after another (they may share a transaction).
 */
export async function loadWorkflowSnapshot(
  db: DatabaseExecutor,
  projectId: string,
): Promise<ProjectWorkflowSnapshot> {
  const [project] = await db
    .select({ templateOptions: projects.templateOptions })
    .from(projects)
    .where(eq(projects.id, projectId));
  const stageRows = await db
    .select({
      id: projectStages.id,
      templateKey: projectStages.templateKey,
      name: projectStages.name,
      description: projectStages.description,
      status: projectStages.status,
      position: projectStages.position,
    })
    .from(projectStages)
    .where(eq(projectStages.projectId, projectId))
    .orderBy(asc(projectStages.position));
  const milestoneRows = await db
    .select({
      id: milestones.id,
      templateKey: milestones.templateKey,
      stageId: milestones.stageId,
      name: milestones.name,
      status: milestones.status,
      requiresClientApproval: milestones.requiresClientApproval,
    })
    .from(milestones)
    .where(eq(milestones.projectId, projectId))
    .orderBy(asc(milestones.position));
  const taskRows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.archivedAt)))
    .orderBy(asc(tasks.number));
  const ids = taskRows.map((task) => task.id);
  const checklist =
    ids.length === 0
      ? []
      : await db
          .select({ taskId: taskChecklistItems.taskId, label: taskChecklistItems.label })
          .from(taskChecklistItems)
          .where(inArray(taskChecklistItems.taskId, ids))
          .orderBy(asc(taskChecklistItems.position));
  const deliverableRows =
    ids.length === 0
      ? []
      : await db
          .select({ taskId: deliverables.taskId, name: deliverables.name })
          .from(deliverables)
          .where(and(inArray(deliverables.taskId, ids), ne(deliverables.status, 'cancelled')));
  const edges =
    ids.length === 0
      ? []
      : await db
          .select({ taskId: taskDependencies.taskId, dependsOn: taskDependencies.dependsOnTaskId })
          .from(taskDependencies)
          .where(inArray(taskDependencies.taskId, ids));
  const labels = groupBy(
    checklist,
    (row) => row.taskId,
    (row) => row.label,
  );
  const names = groupBy(
    deliverableRows,
    (row) => row.taskId ?? '',
    (row) => row.name,
  );
  const prerequisites = groupBy(
    edges,
    (row) => row.taskId,
    (row) => row.dependsOn,
  );
  return {
    templateOptions: project?.templateOptions ?? [],
    stages: stageRows,
    milestones: milestoneRows,
    tasks: taskRows.map((task) => ({
      id: task.id,
      templateKey: task.templateKey,
      parentTaskId: task.parentTaskId,
      stageId: task.stageId,
      milestoneId: task.milestoneId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      requiresReview: task.requiresReview,
      estimateMinutes: task.estimateMinutes,
      escalateAfterOverdueDays: task.escalateAfterOverdueDays,
      plannedStartDate: task.plannedStartDate,
      dueDate: task.dueDate,
      baselineDueDate: task.baselineDueDate,
      checklistLabels: labels.get(task.id) ?? [],
      deliverableNames: names.get(task.id) ?? [],
      prerequisiteTaskIds: prerequisites.get(task.id) ?? [],
    })),
  };
}
