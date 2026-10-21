import type { ProjectRole, TaskPriority } from '@lintel/domain';

export interface DraftAddedStage {
  readonly key: string;
  readonly name: string;
  readonly afterStageKey: string | null;
}

export interface DraftAddedTask {
  readonly key: string;
  readonly stageKey: string;
  readonly title: string;
  readonly durationDays: number;
  readonly dependsOn: readonly string[];
  readonly priority: TaskPriority;
  readonly responsibleRole: ProjectRole;
}

/** A field present means "changed by hand"; absent keeps the template's suggestion. */
export interface DraftAdjustment {
  readonly startDate?: string;
  readonly durationDays?: number;
  /** null: nobody yet. */
  readonly ownerUserId?: string | null;
}

/**
 * The project manager's changes to the template's plan, as edited in the
 * wizard. The server's plan builder dates the result (see the plan preview).
 */
export interface PlanDraft {
  readonly removedStageKeys: readonly string[];
  readonly removedTaskKeys: readonly string[];
  readonly addedStages: readonly DraftAddedStage[];
  readonly addedTasks: readonly DraftAddedTask[];
  readonly adjustments: Readonly<Record<string, DraftAdjustment>>;
  /** Numbers the keys of added items, so each stays unique. */
  readonly counter: number;
}

export const EMPTY_PLAN_DRAFT: PlanDraft = {
  removedStageKeys: [],
  removedTaskKeys: [],
  addedStages: [],
  addedTasks: [],
  adjustments: {},
  counter: 0,
};

export function isDraftEmpty(draft: PlanDraft): boolean {
  return (
    draft.removedStageKeys.length === 0 &&
    draft.removedTaskKeys.length === 0 &&
    draft.addedStages.length === 0 &&
    draft.addedTasks.length === 0 &&
    Object.keys(draft.adjustments).length === 0
  );
}

const without = (list: readonly string[], key: string) => list.filter((item) => item !== key);

/** Leave a template stage or task out of the plan, or bring it back. */
export function includeItem(
  draft: PlanDraft,
  kind: 'stage' | 'task',
  key: string,
  include: boolean,
): PlanDraft {
  const field = kind === 'stage' ? 'removedStageKeys' : 'removedTaskKeys';
  const list = without(draft[field], key);
  return { ...draft, [field]: include ? list : [...list, key] };
}

export function addStage(draft: PlanDraft, name: string, afterStageKey: string | null): PlanDraft {
  const key = `added-stage-${draft.counter + 1}`;
  return {
    ...draft,
    counter: draft.counter + 1,
    addedStages: [...draft.addedStages, { key, name: name.trim(), afterStageKey }],
  };
}

export function addTask(draft: PlanDraft, task: Omit<DraftAddedTask, 'key'>): PlanDraft {
  const key = `added-task-${draft.counter + 1}`;
  return {
    ...draft,
    counter: draft.counter + 1,
    addedTasks: [...draft.addedTasks, { ...task, key, title: task.title.trim() }],
  };
}

/** Deletes an added stage (with its added tasks) or an added task; nothing waits on it after. */
export function deleteAdded(draft: PlanDraft, key: string): PlanDraft {
  const gone = new Set([
    key,
    ...draft.addedTasks.filter((task) => task.stageKey === key).map((task) => task.key),
  ]);
  const adjustments = Object.fromEntries(
    Object.entries(draft.adjustments).filter(([taskKey]) => !gone.has(taskKey)),
  );
  return {
    ...draft,
    addedStages: draft.addedStages.filter((stage) => stage.key !== key),
    addedTasks: draft.addedTasks
      .filter((task) => !gone.has(task.key))
      .map((task) => ({ ...task, dependsOn: task.dependsOn.filter((dep) => !gone.has(dep)) })),
    adjustments,
  };
}

/** Sets (value) or clears (undefined) one hand-made change to a task. */
export function adjustTask<K extends keyof DraftAdjustment>(
  draft: PlanDraft,
  taskKey: string,
  field: K,
  value: DraftAdjustment[K] | undefined,
): PlanDraft {
  const current: Record<string, unknown> = { ...(draft.adjustments[taskKey] ?? {}) };
  if (value === undefined) delete current[field];
  else current[field] = value;
  const adjustments: Record<string, DraftAdjustment> = { ...draft.adjustments };
  if (Object.keys(current).length === 0) delete adjustments[taskKey];
  else adjustments[taskKey] = current as DraftAdjustment;
  return { ...draft, adjustments };
}

/** The API's `tailoring` body. */
export function toTailoring(draft: PlanDraft) {
  return {
    removedStageKeys: [...draft.removedStageKeys],
    removedTaskKeys: [...draft.removedTaskKeys],
    addedStages: draft.addedStages.map((stage) => ({ ...stage })),
    addedTasks: draft.addedTasks.map((task) => ({ ...task, dependsOn: [...task.dependsOn] })),
    adjustments: Object.entries(draft.adjustments).map(([taskKey, adjustment]) => ({
      taskKey,
      ...adjustment,
    })),
  };
}

/** "Left out 2 tasks, added 1 stage, changed 3 tasks" — only what changed; null when nothing. */
export function describeDraft(draft: PlanDraft): string | null {
  const phrase = (verb: string, count: number, noun: string) =>
    count > 0 ? `${verb} ${count} ${noun}${count === 1 ? '' : 's'}` : null;
  const parts = [
    phrase('left out', draft.removedStageKeys.length, 'stage'),
    phrase('left out', draft.removedTaskKeys.length, 'task'),
    phrase('added', draft.addedStages.length, 'stage'),
    phrase('added', draft.addedTasks.length, 'task'),
    phrase('adjusted', Object.keys(draft.adjustments).length, 'task'),
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  const sentence = parts.join(', ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}
