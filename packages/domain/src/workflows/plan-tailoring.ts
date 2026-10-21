import type { CalendarDate } from '@lintel/shared';
import type { ProjectRole } from '../identity/roles';
import type { TaskPriority } from '../tasks/task-status';
import type {
  TemplateStage,
  TemplateTask,
  WorkflowTemplateDefinition,
} from './workflow-template-definition';

/** A stage the project manager adds before the project starts. */
export interface AddedPlanStage {
  /** Plan-local key, unique within the plan (e.g. "added-stage-1"). */
  readonly key: string;
  readonly name: string;
  /** The stage it follows; null puts it first. */
  readonly afterStageKey: string | null;
}

/** A task the project manager adds before the project starts. */
export interface AddedPlanTask {
  readonly key: string;
  readonly stageKey: string;
  readonly title: string;
  readonly durationDays: number;
  readonly dependsOn: readonly string[];
  readonly priority: TaskPriority;
  /** Who does it when no person is chosen for the task itself. */
  readonly responsibleRole: ProjectRole;
}

/** Changes to one task of the plan. Absent fields keep the template's suggestion. */
export interface PlanTaskAdjustment {
  readonly taskKey: string;
  /** Start on this date instead of after its prerequisites. */
  readonly startDate?: CalendarDate | null | undefined;
  /** Working days the task takes instead of the template's duration. */
  readonly durationDays?: number | null | undefined;
  /** Give the task to this person (null = nobody yet) instead of the role's person. */
  readonly ownerUserId?: string | null | undefined;
}

/**
 * How a project manager tailors a template before the project starts:
 * remove or add stages and tasks, change suggested dates and durations, and
 * choose a person per task. The plan builder dates the result.
 */
export interface PlanTailoring {
  readonly removedStageKeys: readonly string[];
  readonly removedTaskKeys: readonly string[];
  readonly addedStages: readonly AddedPlanStage[];
  readonly addedTasks: readonly AddedPlanTask[];
  readonly adjustments: readonly PlanTaskAdjustment[];
}

export const NO_TAILORING: PlanTailoring = {
  removedStageKeys: [],
  removedTaskKeys: [],
  addedStages: [],
  addedTasks: [],
  adjustments: [],
};

/** Longest single task the tailoring accepts, in working days (about a working year). */
export const MAX_TAILORED_DURATION_DAYS = 300;

export function isUntailored(tailoring: PlanTailoring): boolean {
  return (
    tailoring.removedStageKeys.length === 0 &&
    tailoring.removedTaskKeys.length === 0 &&
    tailoring.addedStages.length === 0 &&
    tailoring.addedTasks.length === 0 &&
    tailoring.adjustments.length === 0
  );
}

function addedTemplateTask(task: AddedPlanTask): TemplateTask {
  return {
    key: task.key,
    title: task.title.trim(),
    responsibleRole: task.responsibleRole,
    durationDays: task.durationDays,
    dependsOn: task.dependsOn,
    priority: task.priority,
    requiresReview: false,
    checklist: [],
    deliverables: [],
  };
}

function orderStages(
  kept: readonly TemplateStage[],
  added: readonly AddedPlanStage[],
): TemplateStage[] {
  const asStage = (stage: AddedPlanStage): TemplateStage => ({
    key: stage.key,
    name: stage.name.trim(),
    milestones: [],
    tasks: [],
  });
  const after = (key: string | null) =>
    added.filter((stage) => stage.afterStageKey === key).map(asStage);
  const ordered = after(null);
  for (const stage of kept) ordered.push(stage, ...after(stage.key));
  const placed = new Set(ordered.map((stage) => stage.key));
  // A stage placed after a removed stage goes to the end rather than disappearing.
  for (const stage of added) if (!placed.has(stage.key)) ordered.push(asStage(stage));
  return ordered;
}

/**
 * The template as this project will use it: removed stages and tasks gone
 * (and no longer waited on), added stages in place, added tasks at the end
 * of their stage, and durations changed. Pure; the template is untouched.
 */
export function tailorDefinition(
  definition: WorkflowTemplateDefinition,
  tailoring: PlanTailoring,
): WorkflowTemplateDefinition {
  if (isUntailored(tailoring)) return definition;
  const removedStages = new Set(tailoring.removedStageKeys);
  const removedTasks = new Set(tailoring.removedTaskKeys);
  for (const stage of definition.stages) {
    if (removedStages.has(stage.key)) for (const task of stage.tasks) removedTasks.add(task.key);
  }
  const durations = new Map(
    tailoring.adjustments.flatMap((adjustment) =>
      adjustment.durationDays ? [[adjustment.taskKey, adjustment.durationDays] as const] : [],
    ),
  );
  const keep = (task: TemplateTask): TemplateTask => ({
    ...task,
    durationDays: durations.get(task.key) ?? task.durationDays,
    dependsOn: task.dependsOn.filter((key) => !removedTasks.has(key)),
  });
  const kept = definition.stages
    .filter((stage) => !removedStages.has(stage.key))
    .map((stage) => ({
      ...stage,
      tasks: stage.tasks.filter((task) => !removedTasks.has(task.key)).map(keep),
    }));
  const stages = orderStages(kept, tailoring.addedStages).map((stage) => {
    const added = tailoring.addedTasks
      .filter((task) => task.stageKey === stage.key)
      .map((task) => keep(addedTemplateTask(task)));
    return added.length === 0 ? stage : { ...stage, tasks: [...stage.tasks, ...added] };
  });
  return { ...definition, stages };
}

/** Start dates and people chosen per task, keyed by task key. */
export function tailoredPins(tailoring: PlanTailoring): {
  readonly startDates: ReadonlyMap<string, CalendarDate>;
  readonly owners: ReadonlyMap<string, string | null>;
} {
  const startDates = new Map<string, CalendarDate>();
  const owners = new Map<string, string | null>();
  for (const adjustment of tailoring.adjustments) {
    if (adjustment.startDate) startDates.set(adjustment.taskKey, adjustment.startDate);
    if (adjustment.ownerUserId !== undefined)
      owners.set(adjustment.taskKey, adjustment.ownerUserId);
  }
  return { startDates, owners };
}
