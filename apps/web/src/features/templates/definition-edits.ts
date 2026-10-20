import type {
  TemplateMilestone,
  TemplateOption,
  TemplateStage,
  TemplateTask,
  WorkflowDefinition,
} from './template-types';

/**
 * Pure, immutable edits to a workflow definition. Keys are generated once and
 * never change, so dependencies and milestone links keep pointing at the
 * right things when titles are edited; removing something also removes every
 * reference to it.
 */

/** "Prepare the BOQ!" → "prepare-the-boq", unique among `taken`. */
export function uniqueKey(text: string, taken: ReadonlySet<string>, fallback: string): string {
  const base =
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || fallback;
  const padded = base.length < 2 ? `${base}-${fallback}` : base;
  if (!taken.has(padded)) return padded;
  let suffix = 2;
  while (taken.has(`${padded}-${suffix}`)) suffix += 1;
  return `${padded}-${suffix}`;
}

export function keysIn(definition: WorkflowDefinition): Set<string> {
  return new Set(
    definition.stages.flatMap((stage) => [
      stage.key,
      ...stage.milestones.map((milestone) => milestone.key),
      ...stage.tasks.map((task) => task.key),
    ]),
  );
}

function move<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return [...items];
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  if (item !== undefined) copy.splice(target, 0, item);
  return copy;
}

/** Sets or removes an optional field (exact optional properties never hold `undefined`). */
export function withOptional<T extends object, K extends keyof T>(
  object: T,
  key: K,
  value: T[K] | undefined,
): T {
  const copy = { ...object };
  if (value === undefined) delete copy[key];
  else copy[key] = value;
  return copy;
}

const mapStages = (
  definition: WorkflowDefinition,
  edit: (stage: TemplateStage, index: number) => TemplateStage,
): WorkflowDefinition => ({ ...definition, stages: definition.stages.map(edit) });

export function addStage(definition: WorkflowDefinition): WorkflowDefinition {
  const key = uniqueKey('new-stage', keysIn(definition), 'stage');
  const stage: TemplateStage = { key, name: 'New stage', milestones: [], tasks: [] };
  return { ...definition, stages: [...definition.stages, stage] };
}

export function updateStage(
  definition: WorkflowDefinition,
  stageIndex: number,
  edit: (stage: TemplateStage) => TemplateStage,
): WorkflowDefinition {
  return mapStages(definition, (stage, index) => (index === stageIndex ? edit(stage) : stage));
}

export function moveStage(definition: WorkflowDefinition, index: number, direction: -1 | 1) {
  return { ...definition, stages: move(definition.stages, index, direction) };
}

/** Removes a stage and every dependency or milestone link that pointed into it. */
export function removeStage(definition: WorkflowDefinition, stageIndex: number) {
  const removed = definition.stages[stageIndex];
  if (!removed) return definition;
  const gone = new Set([
    ...removed.tasks.map((task) => task.key),
    ...removed.milestones.map((milestone) => milestone.key),
  ]);
  const remaining = definition.stages.filter((_, index) => index !== stageIndex);
  return {
    ...definition,
    stages: remaining.map((stage) => ({
      ...stage,
      tasks: stage.tasks.map((task) => dropReferences(task, gone)),
    })),
  };
}

function dropReferences(task: TemplateTask, gone: ReadonlySet<string>): TemplateTask {
  const kept = { ...task, dependsOn: task.dependsOn.filter((key) => !gone.has(key)) };
  return task.milestoneKey && gone.has(task.milestoneKey)
    ? withOptional(kept, 'milestoneKey', undefined)
    : kept;
}

export function addTask(definition: WorkflowDefinition, stageIndex: number) {
  const key = uniqueKey('new-task', keysIn(definition), 'task');
  const task: TemplateTask = {
    key,
    title: 'New task',
    responsibleRole: 'designer',
    durationDays: 2,
    dependsOn: [],
    priority: 'medium',
    requiresReview: false,
    checklist: [],
    deliverables: [],
  };
  return {
    definition: updateStage(definition, stageIndex, (stage) => ({
      ...stage,
      tasks: [...stage.tasks, task],
    })),
    key,
  };
}

export function updateTask(
  definition: WorkflowDefinition,
  stageIndex: number,
  taskIndex: number,
  edit: (task: TemplateTask) => TemplateTask,
): WorkflowDefinition {
  return updateStage(definition, stageIndex, (stage) => ({
    ...stage,
    tasks: stage.tasks.map((task, index) => (index === taskIndex ? edit(task) : task)),
  }));
}

export function moveTask(
  definition: WorkflowDefinition,
  stageIndex: number,
  taskIndex: number,
  direction: -1 | 1,
) {
  return updateStage(definition, stageIndex, (stage) => ({
    ...stage,
    tasks: move(stage.tasks, taskIndex, direction),
  }));
}

export function removeTask(definition: WorkflowDefinition, stageIndex: number, taskIndex: number) {
  const key = definition.stages[stageIndex]?.tasks[taskIndex]?.key;
  if (!key) return definition;
  const gone = new Set([key]);
  return mapStages(definition, (stage, index) => ({
    ...stage,
    tasks: stage.tasks
      .filter((_, position) => !(index === stageIndex && position === taskIndex))
      .map((task) => dropReferences(task, gone)),
  }));
}

export function addMilestone(definition: WorkflowDefinition, stageIndex: number) {
  const key = uniqueKey('new-milestone', keysIn(definition), 'milestone');
  const milestone: TemplateMilestone = {
    key,
    name: 'New milestone',
    requiresClientApproval: false,
  };
  return updateStage(definition, stageIndex, (stage) => ({
    ...stage,
    milestones: [...stage.milestones, milestone],
  }));
}

export function removeMilestone(definition: WorkflowDefinition, stageIndex: number, index: number) {
  const key = definition.stages[stageIndex]?.milestones[index]?.key;
  if (!key) return definition;
  const gone = new Set([key]);
  return mapStages(definition, (stage, position) => ({
    ...stage,
    milestones:
      position === stageIndex ? stage.milestones.filter((_, at) => at !== index) : stage.milestones,
    tasks: stage.tasks.map((task) => dropReferences(task, gone)),
  }));
}

export function addOption(definition: WorkflowDefinition): WorkflowDefinition {
  const taken = new Set(definition.options.map((option) => option.key));
  const key = uniqueKey('new-option', taken, 'option').replace(/-/g, '_');
  const option: TemplateOption = { key, label: 'New option', enabledByDefault: true };
  return { ...definition, options: [...definition.options, option] };
}

/** Removes a project option and stops any stage from depending on it. */
export function removeOption(definition: WorkflowDefinition, key: string): WorkflowDefinition {
  return {
    options: definition.options.filter((option) => option.key !== key),
    stages: definition.stages.map((stage) => {
      const left = (stage.requiresOptions ?? []).filter((option) => option !== key);
      return withOptional(stage, 'requiresOptions', left.length > 0 ? left : undefined);
    }),
  };
}
