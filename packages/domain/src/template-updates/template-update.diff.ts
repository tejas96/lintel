import { diffMilestones } from './template-milestone.diff';
import { diffStages } from './template-stage.diff';
import { diffTasks } from './template-task.diff';
import type {
  TemplateFieldChange,
  TemplateItemChange,
  TemplateUpdateInput,
  TemplateUpdatePlan,
} from './template-update.types';
import {
  templateMilestonesByKey,
  templateStagesByKey,
  templateTasksByKey,
} from './template-update-fields';

type Names = ReadonlyMap<string, string>;

/** Names for template keys: the new version's first, then the old one's, then the project's. */
function nameIndex(input: TemplateUpdateInput) {
  const stages = new Map<string, string>();
  const milestones = new Map<string, string>();
  const tasks = new Map<string, string>();
  for (const definition of [input.from, input.to]) {
    for (const [key, stage] of templateStagesByKey(definition)) stages.set(key, stage.name);
    for (const [key, entry] of templateMilestonesByKey(definition))
      milestones.set(key, entry.milestone.name);
    for (const [key, entry] of templateTasksByKey(definition)) tasks.set(key, entry.task.title);
  }
  for (const stage of input.project.stages) {
    if (stage.templateKey) stages.set(stage.templateKey, stage.name);
  }
  for (const milestone of input.project.milestones) {
    if (milestone.templateKey) milestones.set(milestone.templateKey, milestone.name);
  }
  for (const task of input.project.tasks) {
    if (task.templateKey) tasks.set(task.templateKey, task.title);
  }
  return { stages, milestones, tasks };
}

function named(names: Names, key: string | null): string | null {
  return key === null ? null : (names.get(key) ?? key);
}

/** Template keys are for machines; people read stage, milestone and task names. */
function present(
  field: TemplateFieldChange,
  index: ReturnType<typeof nameIndex>,
): TemplateFieldChange {
  switch (field.field) {
    case 'stage':
      return { ...field, from: named(index.stages, field.from), to: named(index.stages, field.to) };
    case 'milestone':
      return {
        ...field,
        from: named(index.milestones, field.from),
        to: named(index.milestones, field.to),
      };
    case 'prerequisites':
      return {
        ...field,
        added: field.added.map((key) => index.tasks.get(key) ?? key),
        removed: field.removed.map((key) => index.tasks.get(key) ?? key),
      };
    default:
      return field;
  }
}

interface UncreatedTargets {
  /** Stages and milestones the new version adds but this update cannot create here. */
  readonly stages: ReadonlySet<string>;
  readonly milestones: ReadonlySet<string>;
}

/**
 * A move into a stage or milestone that will not exist can never apply,
 * ticked or not; an item left with nothing to tick no longer asks for one.
 */
function withoutUncreatedMoves(
  item: TemplateItemChange,
  targets: UncreatedTargets,
): TemplateItemChange {
  if (item.change !== 'changed') return item;
  const fields = item.fields.map((field) => {
    const missing =
      field.field === 'stage'
        ? targets.stages
        : field.field === 'milestone'
          ? targets.milestones
          : null;
    return missing && field.to !== null && missing.has(field.to)
      ? { ...field, outcome: 'unavailable' as const }
      : field;
  });
  const stillHeld = fields.some((field) => field.outcome === 'held');
  return { ...item, fields, optIn: stillHeld ? item.optIn : null };
}

/**
 * Compares a running project with a newer version of its template: what the
 * update would add, change and remove, and which of those changes are held
 * back (started work, committed dates) or can never apply (finished work,
 * closed stages). Pure: the caller applies the plan.
 */
export function planTemplateUpdate(input: TemplateUpdateInput): TemplateUpdatePlan {
  const stages = diffStages(input);
  const closedStageKeys = new Set<string>(stages.blockedStageKeys);
  for (const stage of input.project.stages) {
    if (stage.templateKey && (stage.status === 'completed' || stage.status === 'skipped')) {
      closedStageKeys.add(stage.templateKey);
    }
  }
  const milestones = diffMilestones(input, closedStageKeys);
  const tasks = diffTasks(input, closedStageKeys);
  const targets = {
    stages: stages.blockedStageKeys,
    milestones: new Set(
      milestones.items
        .filter((item) => item.change === 'added' && item.blocked !== null)
        .map((item) => item.templateKey),
    ),
  };
  return {
    items: [...stages.items, ...milestones.items, ...tasks.items].map((item) =>
      withoutUncreatedMoves(item, targets),
    ),
    unchanged: {
      stages: stages.unchanged,
      milestones: milestones.unchanged,
      tasks: tasks.unchanged,
    },
  };
}

/**
 * The same plan for people: stage, milestone and prerequisite keys become
 * names. Keep the raw plan for applying it.
 */
export function presentTemplateUpdatePlan(
  plan: TemplateUpdatePlan,
  input: TemplateUpdateInput,
): TemplateUpdatePlan {
  const index = nameIndex(input);
  const items: TemplateItemChange[] = plan.items.map((item) => ({
    ...item,
    fields: item.fields.map((field) => present(field, index)),
  }));
  return { ...plan, items };
}

/**
 * Whether an item changes when the update is applied: nothing blocked ever
 * does; added and removed items apply unless they need a tick; changed items
 * apply their "apply" fields, and their "held" fields only when ticked.
 */
export function itemWillApply(item: TemplateItemChange, ticked: ReadonlySet<string>): boolean {
  if (item.blocked) return false;
  if (item.change !== 'changed') return item.optIn === null || ticked.has(item.key);
  return item.fields.some(
    (field) => field.outcome === 'apply' || (field.outcome === 'held' && ticked.has(item.key)),
  );
}

/** The fields of a changed item that are written, given what the manager ticked. */
export function fieldsToApply(
  item: TemplateItemChange,
  ticked: ReadonlySet<string>,
): TemplateFieldChange[] {
  if (item.blocked) return [];
  return item.fields.filter(
    (field) => field.outcome === 'apply' || (field.outcome === 'held' && ticked.has(item.key)),
  );
}
