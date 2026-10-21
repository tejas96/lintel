import type {
  TemplateStage,
  WorkflowTemplateDefinition,
} from '../workflows/workflow-template-definition';
import type { TemplateField, TemplateFieldChange } from './template-update.types';

type Scalar = string | number | boolean | null;

function show(value: Scalar): string | null {
  return value === null ? null : String(value);
}

/**
 * A three-way comparison of one value: what the old template said, what the
 * new one says, and what the project holds now. Nothing changes when the
 * template did not change it; a project that already changed the value
 * itself keeps its own version ("kept").
 */
export function templateValueChange(
  field: TemplateField,
  previous: Scalar | undefined,
  next: Scalar,
  current: Scalar,
): TemplateFieldChange | null {
  const baseline = previous === undefined ? current : previous;
  if (baseline === next || current === next) return null;
  return {
    field,
    from: show(current),
    to: show(next),
    added: [],
    removed: [],
    outcome: current === baseline ? 'apply' : 'kept',
  };
}

/**
 * A list compared the same way: entries the new template adds that the
 * project lacks, and entries it drops that the project still has.
 */
export function templateListChange(
  field: TemplateField,
  previous: readonly string[] | undefined,
  next: readonly string[],
  current: readonly string[],
): TemplateFieldChange | null {
  const before = new Set(previous ?? current);
  const after = new Set(next);
  const now = new Set(current);
  const added = next.filter((entry) => !before.has(entry) && !now.has(entry));
  const removed = [...before].filter((entry) => !after.has(entry) && now.has(entry));
  if (added.length === 0 && removed.length === 0) return null;
  return { field, from: null, to: null, added, removed, outcome: 'apply' };
}

/** Holds every change that would otherwise apply (started work, committed dates). */
export function holdTemplateChanges(fields: readonly TemplateFieldChange[]): TemplateFieldChange[] {
  return fields.map((field) => (field.outcome === 'apply' ? { ...field, outcome: 'held' } : field));
}

/** Stages a project with these options includes, in template order. */
export function includedTemplateStages(
  definition: WorkflowTemplateDefinition,
  options: readonly string[],
): TemplateStage[] {
  const chosen = new Set(options);
  return definition.stages.filter((stage) =>
    (stage.requiresOptions ?? []).every((option) => chosen.has(option)),
  );
}

/** Every task of a definition with the key of the stage it sits in. */
export function templateTasksByKey(definition: WorkflowTemplateDefinition) {
  return new Map(
    definition.stages.flatMap((stage) =>
      stage.tasks.map((task) => [task.key, { task, stageKey: stage.key }] as const),
    ),
  );
}

export function templateMilestonesByKey(definition: WorkflowTemplateDefinition) {
  return new Map(
    definition.stages.flatMap((stage) =>
      stage.milestones.map(
        (milestone) => [milestone.key, { milestone, stageKey: stage.key }] as const,
      ),
    ),
  );
}

export function templateStagesByKey(definition: WorkflowTemplateDefinition) {
  return new Map(definition.stages.map((stage) => [stage.key, stage] as const));
}

/** The first project item carrying each template key (subtasks carry none). */
export function indexByTemplateKey<T extends { readonly templateKey: string | null }>(
  items: readonly T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (item.templateKey !== null && !map.has(item.templateKey)) map.set(item.templateKey, item);
  }
  return map;
}
