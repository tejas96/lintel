import type { PlanPreview, TemplateVersion } from '@lintel/api-contracts';
import type { ProjectRole } from '@lintel/domain';
import type { PlanDraft } from './plan-draft';

type Definition = TemplateVersion['definition'];
type PreviewTask = PlanPreview['tasks'][number];

export interface OutlineTask {
  readonly key: string;
  readonly title: string;
  readonly isAdded: boolean;
  /** Left out by hand (or with its stage). */
  readonly removed: boolean;
  readonly stageRemoved: boolean;
  readonly durationDays: number;
  readonly suggestedDurationDays: number;
  readonly responsibleRole: ProjectRole;
  readonly waitsFor: readonly string[];
  /** From the live preview; absent while it loads or for removed tasks. */
  readonly planned: PreviewTask | undefined;
  readonly startChanged: boolean;
  readonly ownerChanged: boolean;
}

export interface OutlineStage {
  readonly key: string;
  readonly name: string;
  readonly isAdded: boolean;
  readonly removed: boolean;
  readonly tasks: readonly OutlineTask[];
  readonly plannedStartDate: string | undefined;
  readonly plannedEndDate: string | undefined;
}

/** Template stages the chosen options include, in order, with added stages in place. */
function stageOrder(definition: Definition, options: readonly string[], draft: PlanDraft) {
  const included = definition.stages.filter((stage) =>
    (stage.requiresOptions ?? []).every((option) => options.includes(option)),
  );
  const added = (after: string | null) =>
    draft.addedStages.filter((s) => s.afterStageKey === after);
  const ordered: { key: string; name: string; isAdded: boolean }[] = added(null).map((stage) => ({
    ...stage,
    isAdded: true,
  }));
  for (const stage of included) {
    ordered.push({ key: stage.key, name: stage.name, isAdded: false });
    ordered.push(...added(stage.key).map((s) => ({ ...s, isAdded: true })));
  }
  const placed = new Set(ordered.map((stage) => stage.key));
  for (const stage of draft.addedStages) {
    if (!placed.has(stage.key)) ordered.push({ ...stage, isAdded: true });
  }
  return { included, ordered };
}

/**
 * Everything the plan editor shows, stage by stage: the template's tasks and
 * the added ones, what was left out, what was changed by hand, and the dates
 * and people from the server's live preview of the tailored plan.
 */
export function buildPlanOutline(
  definition: Definition,
  options: readonly string[],
  draft: PlanDraft,
  preview: PlanPreview | undefined,
): OutlineStage[] {
  const { included, ordered } = stageOrder(definition, options, draft);
  const planned = new Map(preview?.tasks.map((task) => [task.key, task]));
  const plannedStages = new Map(preview?.stages.map((stage) => [stage.key, stage]));
  const titles = new Map<string, string>();
  for (const stage of included) for (const task of stage.tasks) titles.set(task.key, task.title);
  for (const task of draft.addedTasks) titles.set(task.key, task.title);
  return ordered.map((stage) => {
    const removed = draft.removedStageKeys.includes(stage.key);
    const template = included.find((candidate) => candidate.key === stage.key);
    const own = [
      ...(template?.tasks ?? []).map((task) => ({ ...task, isAdded: false })),
      ...draft.addedTasks
        .filter((task) => task.stageKey === stage.key)
        .map((task) => ({ ...task, isAdded: true })),
    ];
    const tasks = own.map((task): OutlineTask => {
      const adjustment = draft.adjustments[task.key] ?? {};
      return {
        key: task.key,
        title: task.title,
        isAdded: task.isAdded,
        removed: removed || draft.removedTaskKeys.includes(task.key),
        stageRemoved: removed,
        durationDays: adjustment.durationDays ?? task.durationDays,
        suggestedDurationDays: task.durationDays,
        responsibleRole: task.responsibleRole,
        waitsFor: task.dependsOn.flatMap((key) => {
          const title = titles.get(key);
          return title && planned.has(key) ? [title] : [];
        }),
        planned: planned.get(task.key),
        startChanged: adjustment.startDate !== undefined,
        ownerChanged: adjustment.ownerUserId !== undefined,
      };
    });
    const dates = plannedStages.get(stage.key);
    return {
      ...stage,
      removed,
      tasks,
      plannedStartDate: dates?.plannedStartDate,
      plannedEndDate: dates?.plannedEndDate,
    };
  });
}

/** Every task that stays in the plan, for "waits for" choices. */
export function keptTasks(outline: readonly OutlineStage[]): { key: string; title: string }[] {
  return outline.flatMap((stage) =>
    stage.tasks
      .filter((task) => !task.removed)
      .map((task) => ({ key: task.key, title: task.title })),
  );
}
