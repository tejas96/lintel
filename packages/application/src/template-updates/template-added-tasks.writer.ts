import { itemWillApply, templateTasksByKey } from '@lintel/domain';
import type { ApplicationStores } from '../common/unit-of-work';
import type { AssignedTask } from '../projects/project-assignment.notices';
import type { UpdateIds } from './template-structure.writer';
import type { TemplateUpdateContext } from './template-update.loader';
import type { NewTemplateTaskRow } from './template-update.store';

type Stores = Pick<ApplicationStores, 'templateUpdates' | 'tasks'>;

export interface AddedTasksResult {
  readonly count: number;
  readonly assigned: AssignedTask[];
}

function rowsFor(
  context: TemplateUpdateContext,
  keys: readonly string[],
  ids: UpdateIds,
  firstNumber: number,
): NewTemplateTaskRow[] {
  const templates = templateTasksByKey(context.input.to);
  const added = new Set(keys);
  const rows: NewTemplateTaskRow[] = [];
  let number = firstNumber;
  for (const key of keys) {
    const entry = templates.get(key);
    const schedule = context.schedule.get(key);
    if (!entry || !schedule) continue;
    const { task } = entry;
    const stage = context.input.to.stages.find((candidate) => candidate.key === entry.stageKey);
    const reviewerUserId = task.requiresReview ? schedule.reviewerUserId : null;
    const row: NewTemplateTaskRow = {
      key,
      parentKey: null,
      templateKey: key,
      stageId: ids.stages.get(entry.stageKey) ?? null,
      milestoneId: task.milestoneKey ? (ids.milestones.get(task.milestoneKey) ?? null) : null,
      number,
      title: task.title,
      description: task.description ?? null,
      status: schedule.ownerUserId ? 'ready' : 'draft',
      priority: task.priority,
      ownerUserId: schedule.ownerUserId,
      reviewerUserId,
      plannedStartDate: schedule.plannedStartDate,
      dueDate: schedule.dueDate,
      estimateMinutes: task.estimateMinutes ?? null,
      requiresReview: task.requiresReview,
      escalateAfterOverdueDays: task.escalateAfterOverdueDays ?? 1,
      position: stage ? stage.tasks.findIndex((candidate) => candidate.key === key) : 0,
      checklist: task.checklist.map((item) => ({ label: item.label, isRequired: item.required })),
      deliverables: task.deliverables.map((item) => ({
        name: item.name,
        isRequired: item.required,
        reviewerUserId: reviewerUserId ?? context.project.managerUserId,
      })),
      dependsOnKeys: task.dependsOn.filter((dependency) => added.has(dependency)),
      dependsOnTaskIds: task.dependsOn
        .filter((dependency) => !added.has(dependency))
        .map((dependency) => ids.tasks.get(dependency))
        .filter((id): id is string => id !== undefined),
    };
    number += 1;
    const subtasks = (task.subtasks ?? []).map(
      (subtask, index): NewTemplateTaskRow => ({
        ...row,
        key: `${key}#${index + 1}`,
        parentKey: key,
        templateKey: null,
        milestoneId: null,
        number: number + index,
        title: subtask.title,
        description: null,
        reviewerUserId: null,
        estimateMinutes: subtask.estimateMinutes ?? null,
        requiresReview: false,
        position: index,
        checklist: [],
        deliverables: [],
        dependsOnKeys: [],
        dependsOnTaskIds: [],
      }),
    );
    number += subtasks.length;
    rows.push(row, ...subtasks);
  }
  return rows;
}

/** The dates each stage must cover once the new tasks are in it. */
function stageSpans(
  rows: readonly NewTemplateTaskRow[],
): Map<string, { start: string; end: string }> {
  const spans = new Map<string, { start: string; end: string }>();
  for (const row of rows) {
    if (!row.stageId) continue;
    const span = spans.get(row.stageId);
    spans.set(row.stageId, {
      start: span && span.start < row.plannedStartDate ? span.start : row.plannedStartDate,
      end: span && span.end > row.dueDate ? span.end : row.dueDate,
    });
  }
  return spans;
}

/**
 * Inserts the tasks the new version adds (with subtasks, checklists,
 * deliverables and prerequisites), widens their stages' dates and records
 * each new commitment in schedule history.
 */
export async function addTemplateTasks(
  stores: Stores,
  context: TemplateUpdateContext,
  ticked: ReadonlySet<string>,
  ids: UpdateIds,
  actor: { readonly userId: string; readonly reason: string },
): Promise<AddedTasksResult> {
  const keys = context.plan.items
    .filter(
      (item) => item.kind === 'task' && item.change === 'added' && itemWillApply(item, ticked),
    )
    .map((item) => item.templateKey);
  if (keys.length === 0) return { count: 0, assigned: [] };
  await stores.tasks.lockProject(context.project.id);
  const first = await stores.templateUpdates.nextTaskNumber(context.project.id);
  const rows = rowsFor(context, keys, ids, first);
  const created = await stores.templateUpdates.insertTasks(context.project.id, actor.userId, rows);
  const assigned: AssignedTask[] = [];
  for (const row of rows.filter((candidate) => candidate.parentKey === null)) {
    const taskId = created.get(row.key);
    if (!taskId) continue;
    ids.tasks.set(row.key, taskId);
    await stores.tasks.recordScheduleChange({
      taskId,
      previousDueDate: null,
      newDueDate: row.dueDate,
      reason: actor.reason,
      changedByUserId: actor.userId,
    });
    if (row.status === 'ready' && row.ownerUserId) {
      assigned.push({ taskId, ownerUserId: row.ownerUserId });
    }
  }
  for (const [stageId, span] of stageSpans(rows)) {
    await stores.templateUpdates.extendStageDates(stageId, span.start, span.end);
  }
  return { count: keys.length, assigned };
}
