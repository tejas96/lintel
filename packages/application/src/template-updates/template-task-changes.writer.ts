import {
  domainEvent,
  fieldsToApply,
  itemWillApply,
  type TemplateFieldChange,
  type TemplateItemChange,
  type TemplateTask,
  templateTasksByKey,
  wouldCreateDependencyCycle,
} from '@lintel/domain';
import { StaleVersionError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import { cancelSubtasksByDecision, cancelTaskByDecision } from '../tasks/cancel-task-by-decision';
import type { UpdateIds } from './template-structure.writer';
import type { TemplateUpdateContext } from './template-update.loader';
import type { TemplateTaskChanges } from './template-update.store';

type Stores = Pick<
  ApplicationStores,
  'templateUpdates' | 'tasks' | 'taskItems' | 'records' | 'workSessions'
>;
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export interface ChangeActor {
  readonly userId: string;
  /** Why, for schedule history and cancellations ("Template updated to v3"). */
  readonly reason: string;
  readonly context: RequestContext;
  readonly at: Date;
}

type ScalarWriter = (task: TemplateTask, stageKey: string, ids: UpdateIds) => TemplateTaskChanges;

/** How each applied field of a changed task is written (list fields are handled separately). */
const SCALAR_WRITERS: Partial<Record<TemplateFieldChange['field'], ScalarWriter>> = {
  title: (task) => ({ title: task.title }),
  description: (task) => ({ description: task.description ?? null }),
  priority: (task) => ({ priority: task.priority }),
  requiresReview: (task) => ({ requiresReview: task.requiresReview }),
  estimateMinutes: (task) => ({ estimateMinutes: task.estimateMinutes ?? null }),
  escalateAfterOverdueDays: (task) => ({
    escalateAfterOverdueDays: task.escalateAfterOverdueDays ?? 1,
  }),
  // A stage or milestone the update did not create leaves the task where it is.
  stage: (_task, stageKey, ids) => {
    const stageId = ids.stages.get(stageKey);
    return stageId ? { stageId } : {};
  },
  milestone: (task, _stageKey, ids) => {
    if (!task.milestoneKey) return { milestoneId: null };
    const milestoneId = ids.milestones.get(task.milestoneKey);
    return milestoneId ? { milestoneId } : {};
  },
};

function scalarChanges(
  fields: readonly TemplateFieldChange[],
  task: TemplateTask,
  stageKey: string,
  ids: UpdateIds,
): TemplateTaskChanges {
  return Object.assign(
    {},
    ...fields.map((field) => SCALAR_WRITERS[field.field]?.(task, stageKey, ids) ?? {}),
  );
}

interface ListContext {
  readonly stores: Stores;
  readonly context: TemplateUpdateContext;
  readonly taskId: string;
  readonly task: TemplateTask;
  readonly ids: UpdateIds;
  readonly actorUserId: string;
}

async function applyChecklist(list: ListContext, field: TemplateFieldChange): Promise<void> {
  const required = new Map(list.task.checklist.map((item) => [item.label, item.required]));
  const added = field.added.map((label) => ({ label, isRequired: required.get(label) ?? true }));
  if (added.length > 0) await list.stores.taskItems.addChecklistItems(list.taskId, added);
  if (field.removed.length > 0) {
    await list.stores.templateUpdates.removeOpenChecklistItems(list.taskId, field.removed);
  }
}

async function applyDeliverables(list: ListContext, field: TemplateFieldChange): Promise<void> {
  const required = new Map(list.task.deliverables.map((item) => [item.name, item.required]));
  await list.stores.templateUpdates.addDeliverables(
    list.context.project.id,
    list.taskId,
    field.added.map((name) => ({
      name,
      isRequired: required.get(name) ?? true,
      reviewerUserId: list.context.project.managerUserId,
    })),
  );
  await list.stores.templateUpdates.cancelUnsubmittedDeliverables(list.taskId, field.removed);
}

/** Prerequisites follow the template, but never so as to make a loop with the project's own links. */
async function applyPrerequisites(list: ListContext, field: TemplateFieldChange): Promise<void> {
  const { stores, taskId, ids } = list;
  const edges = [...(await stores.tasks.dependencyGraph(list.context.project.id)).edges];
  for (const key of field.removed) {
    const dependsOnTaskId = ids.tasks.get(key);
    if (dependsOnTaskId) await stores.tasks.removeDependency({ taskId, dependsOnTaskId });
  }
  for (const key of field.added) {
    const dependsOnTaskId = ids.tasks.get(key);
    if (!dependsOnTaskId) continue;
    const edge = { taskId, dependsOnTaskId };
    if (wouldCreateDependencyCycle(edges, edge)) continue;
    await stores.tasks.addDependency(edge, list.actorUserId);
    edges.push(edge);
  }
}

const LIST_WRITERS: Partial<
  Record<
    TemplateFieldChange['field'],
    (list: ListContext, field: TemplateFieldChange) => Promise<void>
  >
> = {
  checklist: applyChecklist,
  deliverables: applyDeliverables,
  prerequisites: applyPrerequisites,
};

async function applyLists(
  list: ListContext,
  fields: readonly TemplateFieldChange[],
): Promise<void> {
  for (const field of fields) await LIST_WRITERS[field.field]?.(list, field);
}

/** Writes the applied fields of changed tasks. Returns tasks whose dates moved. */
export async function changeTemplateTasks(
  stores: Stores,
  context: TemplateUpdateContext,
  ticked: ReadonlySet<string>,
  ids: UpdateIds,
  actor: ChangeActor,
): Promise<{ changed: number; moved: number }> {
  const templates = templateTasksByKey(context.input.to);
  let changed = 0;
  let moved = 0;
  const items = context.plan.items.filter(
    (item) => item.kind === 'task' && item.change === 'changed' && itemWillApply(item, ticked),
  );
  for (const item of items) {
    const entry = templates.get(item.templateKey);
    if (!entry || !item.itemId) continue;
    const fields = fieldsToApply(item, ticked);
    const changes: Mutable<TemplateTaskChanges> = scalarChanges(
      fields,
      entry.task,
      entry.stageKey,
      ids,
    );
    const move = fields.some((field) => field.field === 'duration') ? item.dates : null;
    if (move) {
      changes.plannedStartDate = move.toStart;
      changes.dueDate = move.toDue;
    }
    if (Object.keys(changes).length > 0)
      await stores.templateUpdates.updateTask(item.itemId, changes);
    await applyLists(
      { stores, context, taskId: item.itemId, task: entry.task, ids, actorUserId: actor.userId },
      fields,
    );
    if (move) {
      moved += 1;
      await stores.tasks.recordScheduleChange({
        taskId: item.itemId,
        previousDueDate: move.fromDue,
        newDueDate: move.toDue,
        reason: actor.reason,
        changedByUserId: actor.userId,
      });
      await stores.records.enqueueEvent(
        domainEvent('TaskScheduleChanged', 'task', item.itemId, {
          taskId: item.itemId,
          projectId: context.project.id,
          dueDate: move.toDue,
        }),
      );
    }
    changed += 1;
  }
  return { changed, moved };
}

/** Cancels removed tasks (and their unstarted subtasks); never deletes them. */
export async function cancelRemovedTasks(
  stores: Stores,
  context: TemplateUpdateContext,
  ticked: ReadonlySet<string>,
  actor: ChangeActor,
): Promise<TemplateItemChange[]> {
  const items = context.plan.items.filter(
    (item) => item.kind === 'task' && item.change === 'removed' && itemWillApply(item, ticked),
  );
  const cancellation = {
    context: actor.context,
    reason: actor.reason,
    at: actor.at,
    source: { templateVersionId: context.target.id },
  };
  for (const item of items) {
    if (!item.itemId) continue;
    // The snapshot locked these rows, so a miss means the plan no longer holds.
    const task = await stores.tasks.findForUpdate(item.itemId);
    if (!task || !(await cancelTaskByDecision(stores, task, cancellation))) {
      throw new StaleVersionError('A task in this project');
    }
    const subtaskIds = await stores.templateUpdates.unstartedSubtaskIds(item.itemId);
    await cancelSubtasksByDecision(stores, subtaskIds, cancellation);
  }
  return items;
}
