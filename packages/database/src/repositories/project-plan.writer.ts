import { randomUUID } from 'node:crypto';
import type { NewProjectPlan } from '@lintel/application';
import type { DatabaseExecutor } from '../client';
import {
  deliverables,
  milestones,
  projectStages,
  taskChecklistItems,
  taskDependencies,
  tasks,
} from '../schema';

function idsFor(keys: readonly string[]): Map<string, string> {
  return new Map(keys.map((key) => [key, randomUUID()]));
}

function idOf(ids: Map<string, string>, key: string): string {
  const id = ids.get(key);
  if (!id) throw new Error(`Plan refers to unknown key "${key}".`);
  return id;
}

function optionalIdOf(ids: Map<string, string>, key: string | null): string | null {
  return key === null ? null : idOf(ids, key);
}

/**
 * Writes a resolved plan. IDs are generated up front so stages, milestones,
 * tasks (including subtasks pointing at their parent), checklists,
 * deliverables and dependencies each go in as one multi-row insert.
 * Returns the database ID of every task by plan key.
 */
export async function insertProjectPlan(
  db: DatabaseExecutor,
  projectId: string,
  createdByUserId: string,
  plan: NewProjectPlan,
): Promise<Map<string, string>> {
  const stageIds = idsFor(plan.stages.map((stage) => stage.key));
  const milestoneIds = idsFor(plan.milestones.map((milestone) => milestone.key));
  const taskIds = idsFor(plan.tasks.map((task) => task.key));
  const now = new Date();
  if (plan.stages.length > 0) {
    await db.insert(projectStages).values(
      plan.stages.map((stage) => ({
        id: idOf(stageIds, stage.key),
        projectId,
        templateKey: stage.templateKey,
        name: stage.name,
        description: stage.description,
        position: stage.position,
        status: stage.status,
        plannedStartDate: stage.plannedStartDate,
        plannedEndDate: stage.plannedEndDate,
        startedAt: stage.status === 'active' ? now : null,
      })),
    );
  }
  if (plan.milestones.length > 0) {
    await db.insert(milestones).values(
      plan.milestones.map((milestone) => ({
        id: idOf(milestoneIds, milestone.key),
        projectId,
        stageId: idOf(stageIds, milestone.stageKey),
        templateKey: milestone.key,
        name: milestone.name,
        dueDate: milestone.dueDate,
        baselineDueDate: milestone.dueDate,
        requiresClientApproval: milestone.requiresClientApproval,
        position: milestone.position,
      })),
    );
  }
  if (plan.tasks.length === 0) return taskIds;
  await db.insert(tasks).values(
    plan.tasks.map((task) => ({
      id: idOf(taskIds, task.key),
      projectId,
      stageId: optionalIdOf(stageIds, task.stageKey),
      milestoneId: optionalIdOf(milestoneIds, task.milestoneKey),
      parentTaskId: optionalIdOf(taskIds, task.parentKey),
      number: task.number,
      templateKey: task.templateKey,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      ownerUserId: task.ownerUserId,
      reviewerUserId: task.reviewerUserId,
      plannedStartDate: task.plannedStartDate,
      dueDate: task.dueDate,
      baselineDueDate: task.dueDate,
      estimateMinutes: task.estimateMinutes,
      requiresReview: task.requiresReview,
      escalateAfterOverdueDays: task.escalateAfterOverdueDays,
      position: task.position,
      createdByUserId,
    })),
  );
  const checklist = plan.tasks.flatMap((task) =>
    task.checklist.map((item, position) => ({
      taskId: idOf(taskIds, task.key),
      label: item.label,
      isRequired: item.isRequired,
      position,
    })),
  );
  if (checklist.length > 0) await db.insert(taskChecklistItems).values(checklist);
  const deliverableRows = plan.deliverables.map((deliverable) => ({
    projectId,
    taskId: idOf(taskIds, deliverable.taskKey),
    name: deliverable.name,
    isRequired: deliverable.isRequired,
    status: 'not_submitted' as const,
    reviewerUserId: deliverable.reviewerUserId,
  }));
  if (deliverableRows.length > 0) await db.insert(deliverables).values(deliverableRows);
  const dependencies = plan.tasks.flatMap((task) =>
    task.dependsOn.map((key) => ({
      taskId: idOf(taskIds, task.key),
      dependsOnTaskId: idOf(taskIds, key),
      createdByUserId,
    })),
  );
  if (dependencies.length > 0) await db.insert(taskDependencies).values(dependencies);
  return taskIds;
}
