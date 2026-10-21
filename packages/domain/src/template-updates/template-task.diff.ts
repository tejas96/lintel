import type { TemplateTask } from '../workflows/workflow-template-definition';
import { durationMove, fieldChanges, keyOf, type TaskContext } from './template-task-fields';
import {
  isNotStartedTask,
  type SnapshotTask,
  type TemplateItemChange,
  type TemplateUpdateInput,
  templateItemKey,
} from './template-update.types';
import {
  holdTemplateChanges,
  includedTemplateStages,
  indexByTemplateKey,
  templateTasksByKey,
} from './template-update-fields';

const STARTED = 'Work has started on this task. Tick to update it anyway.';
const COMMITTED = 'Its dates are committed. Tick to move them.';

function changedTask(
  context: TaskContext,
  task: SnapshotTask,
  previous: { task: TemplateTask; stageKey: string } | undefined,
  next: { task: TemplateTask; stageKey: string },
): TemplateItemChange | null {
  const fields = fieldChanges(context, task, previous, next);
  const duration = durationMove(context, task, previous?.task, next.task);
  if (duration) fields.push(duration.field);
  if (fields.length === 0) return null;
  const base = {
    key: templateItemKey('task', next.task.key),
    kind: 'task' as const,
    change: 'changed' as const,
    templateKey: next.task.key,
    itemId: task.id,
    name: task.title,
    stageKey: next.stageKey,
    status: task.status,
    dates: duration?.dates ?? null,
  };
  if (task.status === 'done' || task.status === 'in_review') {
    return {
      ...base,
      fields: holdTemplateChanges(fields),
      optIn: null,
      blocked: {
        reason:
          task.status === 'done'
            ? 'Finished work stays as it was recorded.'
            : 'It is waiting for review. Decide the review first.',
      },
    };
  }
  if (!isNotStartedTask(task.status)) {
    const shown = holdTemplateChanges(fields);
    const anyHeld = shown.some((field) => field.outcome === 'held');
    return { ...base, fields: shown, optIn: anyHeld ? { reason: STARTED } : null, blocked: null };
  }
  const held = fields.some((field) => field.outcome === 'held');
  return { ...base, fields, optIn: held ? { reason: COMMITTED } : null, blocked: null };
}

function removedTask(
  task: SnapshotTask,
  templateKey: string,
  stageKey: string | null,
): TemplateItemChange {
  const base = {
    key: templateItemKey('task', templateKey),
    kind: 'task' as const,
    change: 'removed' as const,
    templateKey,
    itemId: task.id,
    name: task.title,
    stageKey,
    status: task.status,
    fields: [],
    dates: null,
  };
  if (isNotStartedTask(task.status)) return { ...base, optIn: null, blocked: null };
  if (task.status === 'done') {
    return { ...base, optIn: null, blocked: { reason: 'It is finished and stays in the record.' } };
  }
  if (task.status === 'in_review') {
    return {
      ...base,
      optIn: null,
      blocked: { reason: 'It is waiting for review. Decide the review first.' },
    };
  }
  return {
    ...base,
    optIn: { reason: 'Work has started. Tick to cancel it anyway.' },
    blocked: null,
  };
}

function addedTask(next: TemplateTask, stageKey: string, closed: boolean): TemplateItemChange {
  return {
    key: templateItemKey('task', next.key),
    kind: 'task',
    change: 'added',
    templateKey: next.key,
    itemId: null,
    name: next.title,
    stageKey,
    status: null,
    fields: [],
    dates: null,
    optIn: null,
    blocked: closed ? { reason: 'Its stage cannot take new work.' } : null,
  };
}

function taskContext(input: TemplateUpdateInput): TaskContext {
  const { project } = input;
  return {
    input,
    stageKeyById: new Map(project.stages.map((stage) => [stage.id, stage.templateKey])),
    milestoneKeyById: new Map(
      project.milestones.map((milestone) => [milestone.id, milestone.templateKey]),
    ),
    taskKeyById: new Map(project.tasks.map((task) => [task.id, task.templateKey])),
  };
}

/** Tasks the new version adds, changes or drops, measured against the project's own tasks. */
export function diffTasks(
  input: TemplateUpdateInput,
  closedStageKeys: ReadonlySet<string>,
): { items: TemplateItemChange[]; unchanged: number } {
  const { project } = input;
  const topLevel = project.tasks.filter((task) => task.parentTaskId === null);
  const context = taskContext(input);
  const previous = templateTasksByKey(input.from);
  const current = indexByTemplateKey(topLevel);
  const items: TemplateItemChange[] = [];
  const kept = new Set<string>();
  let unchanged = 0;
  for (const stage of includedTemplateStages(input.to, project.templateOptions)) {
    for (const next of stage.tasks) {
      kept.add(next.key);
      const existing = current.get(next.key);
      if (!existing) {
        items.push(addedTask(next, stage.key, closedStageKeys.has(stage.key)));
      } else if (existing.status !== 'cancelled') {
        const change = changedTask(context, existing, previous.get(next.key), {
          task: next,
          stageKey: stage.key,
        });
        if (change) items.push(change);
        else unchanged += 1;
      }
    }
  }
  for (const task of topLevel) {
    const key = task.templateKey;
    if (key === null || kept.has(key) || task.status === 'cancelled') continue;
    items.push(removedTask(task, key, keyOf(context.stageKeyById, task.stageId)));
  }
  return { items, unchanged };
}
