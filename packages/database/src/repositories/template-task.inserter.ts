import { randomUUID } from 'node:crypto';
import type { NewTemplateTaskRow } from '@lintel/application';
import type { DatabaseExecutor } from '../client';
import { deliverables, taskChecklistItems, taskDependencies, tasks } from '../schema';

/**
 * Writes the tasks a template update adds. IDs are made up front so
 * subtasks can point at their parent and new tasks at each other; each kind
 * of row goes in as one multi-row insert. Returns task IDs by key.
 */
export async function insertTemplateTasks(
  db: DatabaseExecutor,
  projectId: string,
  createdByUserId: string,
  rows: readonly NewTemplateTaskRow[],
): Promise<Map<string, string>> {
  const ids = new Map(rows.map((row) => [row.key, randomUUID()]));
  const idOf = (key: string): string => {
    const id = ids.get(key);
    if (!id) throw new Error(`Template update refers to unknown task key "${key}".`);
    return id;
  };
  if (rows.length === 0) return ids;
  await db.insert(tasks).values(
    rows.map((row) => ({
      id: idOf(row.key),
      projectId,
      stageId: row.stageId,
      milestoneId: row.milestoneId,
      parentTaskId: row.parentKey === null ? null : idOf(row.parentKey),
      number: row.number,
      templateKey: row.templateKey,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      ownerUserId: row.ownerUserId,
      reviewerUserId: row.reviewerUserId,
      plannedStartDate: row.plannedStartDate,
      dueDate: row.dueDate,
      baselineDueDate: row.dueDate,
      estimateMinutes: row.estimateMinutes,
      requiresReview: row.requiresReview,
      escalateAfterOverdueDays: row.escalateAfterOverdueDays,
      position: row.position,
      createdByUserId,
    })),
  );
  const checklist = rows.flatMap((row) =>
    row.checklist.map((item, position) => ({
      taskId: idOf(row.key),
      label: item.label,
      isRequired: item.isRequired,
      position,
    })),
  );
  if (checklist.length > 0) await db.insert(taskChecklistItems).values(checklist);
  const deliverableRows = rows.flatMap((row) =>
    row.deliverables.map((item) => ({
      projectId,
      taskId: idOf(row.key),
      name: item.name,
      isRequired: item.isRequired,
      status: 'not_submitted' as const,
      reviewerUserId: item.reviewerUserId,
    })),
  );
  if (deliverableRows.length > 0) await db.insert(deliverables).values(deliverableRows);
  const edges = rows.flatMap((row) => [
    ...row.dependsOnKeys.map((key) => ({
      taskId: idOf(row.key),
      dependsOnTaskId: idOf(key),
      createdByUserId,
    })),
    ...row.dependsOnTaskIds.map((dependsOnTaskId) => ({
      taskId: idOf(row.key),
      dependsOnTaskId,
      createdByUserId,
    })),
  ]);
  if (edges.length > 0) await db.insert(taskDependencies).values(edges);
  return ids;
}
