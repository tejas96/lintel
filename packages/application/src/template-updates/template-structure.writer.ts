import {
  fieldsToApply,
  itemWillApply,
  type TemplateItemChange,
  templateMilestonesByKey,
  templateStagesByKey,
  templateTasksByKey,
} from '@lintel/domain';
import type { ApplicationStores } from '../common/unit-of-work';
import type { TemplateUpdateContext } from './template-update.loader';
import type { MilestoneRowChanges, StageRowChanges } from './template-update.store';

type Stores = Pick<ApplicationStores, 'templateUpdates'>;

/** Database IDs by template key, for existing and newly added items. */
export interface UpdateIds {
  readonly stages: Map<string, string>;
  readonly milestones: Map<string, string>;
  readonly tasks: Map<string, string>;
}

export function existingIds(context: TemplateUpdateContext): UpdateIds {
  const index = <T extends { templateKey: string | null; id: string }>(items: readonly T[]) =>
    new Map(
      items.flatMap((item) => (item.templateKey ? [[item.templateKey, item.id] as const] : [])),
    );
  const { project } = context.input;
  return {
    stages: index(project.stages),
    milestones: index(project.milestones),
    tasks: index(project.tasks.filter((task) => task.parentTaskId === null)),
  };
}

function applies(context: TemplateUpdateContext, ticked: ReadonlySet<string>, kind: string) {
  return context.plan.items.filter((item) => item.kind === kind && itemWillApply(item, ticked));
}

interface StageSlot {
  readonly id: string | null;
  readonly key: string | null;
  readonly position: number;
}

/**
 * The project's stage order after the update: existing stages keep their
 * order, and each added stage goes right after the nearest earlier template
 * stage the project has (the diff already refused places before started work).
 */
function stageOrder(
  context: TemplateUpdateContext,
  added: readonly TemplateItemChange[],
): StageSlot[] {
  const order = context.input.to.stages.map((stage) => stage.key);
  const slots: StageSlot[] = [...context.input.project.stages]
    .sort((left, right) => left.position - right.position)
    .map((stage) => ({ id: stage.id, key: stage.templateKey, position: stage.position }));
  for (const item of added) {
    const earlier = order.slice(0, order.indexOf(item.templateKey)).reverse();
    const anchor = earlier.find((key) => slots.some((slot) => slot.key === key));
    const at = anchor ? slots.findIndex((slot) => slot.key === anchor) + 1 : 0;
    slots.splice(at, 0, { id: null, key: item.templateKey, position: -1 });
  }
  return slots;
}

/**
 * Adds new stages in template order (positions of later stages shift by
 * one) and renames changed ones. A project whose stages are all finished
 * starts its first new stage straight away.
 */
export async function applyStages(
  stores: Stores,
  context: TemplateUpdateContext,
  ticked: ReadonlySet<string>,
  ids: UpdateIds,
): Promise<void> {
  const templateStages = templateStagesByKey(context.input.to);
  const stageItems = applies(context, ticked, 'stage');
  const slots = stageOrder(
    context,
    stageItems.filter((item) => item.change === 'added'),
  );
  let activated = context.input.project.stages.some(
    (stage) => stage.status === 'active' || stage.status === 'pending',
  );
  for (const [position, slot] of slots.entries()) {
    if (slot.id !== null) {
      if (slot.position !== position)
        await stores.templateUpdates.updateStage(slot.id, { position });
      continue;
    }
    const stage = slot.key ? templateStages.get(slot.key) : undefined;
    if (!stage) continue;
    const id = await stores.templateUpdates.insertStage(context.project.id, {
      templateKey: stage.key,
      name: stage.name,
      description: stage.description ?? null,
      position,
      status: activated ? 'pending' : 'active',
    });
    activated = true;
    ids.stages.set(stage.key, id);
  }
  for (const item of stageItems) {
    const stage = templateStages.get(item.templateKey);
    if (item.change !== 'changed' || !item.itemId || !stage) continue;
    const changes: StageRowChanges = Object.assign(
      {},
      ...fieldsToApply(item, ticked).map((field) =>
        field.field === 'name'
          ? { name: stage.name }
          : field.field === 'description'
            ? { description: stage.description ?? null }
            : {},
      ),
    );
    await stores.templateUpdates.updateStage(item.itemId, changes);
  }
}

/**
 * The due date of a new milestone: its latest linked task, else its stage's
 * latest task, else the first day its stage can hold work.
 */
function milestoneDueDate(
  context: TemplateUpdateContext,
  milestoneKey: string,
  stageKey: string,
): string {
  const templateTasks = [...templateTasksByKey(context.input.to).values()];
  const dueOf = (key: string): string | null =>
    context.schedule.get(key)?.dueDate ??
    context.input.project.tasks.find(
      (task) => task.templateKey === key && task.status !== 'cancelled',
    )?.dueDate ??
    null;
  const linked = templateTasks
    .filter((entry) => entry.task.milestoneKey === milestoneKey)
    .map((entry) => dueOf(entry.task.key));
  const inStage = templateTasks
    .filter((entry) => entry.stageKey === stageKey)
    .map((entry) => dueOf(entry.task.key));
  const dates = (linked.some((date) => date !== null) ? linked : inStage).filter(
    (date): date is string => date !== null,
  );
  const floor: string = context.stageStarts.get(stageKey) ?? context.today;
  return dates.reduce((max, date) => (date > max ? date : max), floor);
}

/** Adds new milestones, updates changed pending ones, cancels removed pending ones. */
export async function applyMilestones(
  stores: Stores,
  context: TemplateUpdateContext,
  ticked: ReadonlySet<string>,
  ids: UpdateIds,
): Promise<void> {
  const templateMilestones = templateMilestonesByKey(context.input.to);
  let position = context.input.project.milestones.length;
  for (const item of applies(context, ticked, 'milestone')) {
    const entry = templateMilestones.get(item.templateKey);
    if (item.change === 'removed' && item.itemId) {
      await stores.templateUpdates.updateMilestone(item.itemId, { status: 'cancelled' });
      continue;
    }
    if (!entry) continue;
    const stageId = ids.stages.get(entry.stageKey) ?? null;
    if (item.change === 'added' && stageId) {
      const id = await stores.templateUpdates.insertMilestone(context.project.id, {
        stageId,
        templateKey: entry.milestone.key,
        name: entry.milestone.name,
        dueDate: milestoneDueDate(context, entry.milestone.key, entry.stageKey),
        requiresClientApproval: entry.milestone.requiresClientApproval,
        position,
      });
      position += 1;
      ids.milestones.set(entry.milestone.key, id);
      continue;
    }
    if (item.change !== 'changed' || !item.itemId) continue;
    await stores.templateUpdates.updateMilestone(
      item.itemId,
      milestoneChanges(item, ticked, entry, stageId),
    );
  }
}

function milestoneChanges(
  item: TemplateItemChange,
  ticked: ReadonlySet<string>,
  entry: { milestone: { name: string; requiresClientApproval: boolean } },
  stageId: string | null,
): MilestoneRowChanges {
  const changes: { -readonly [K in keyof MilestoneRowChanges]: MilestoneRowChanges[K] } = {};
  for (const field of fieldsToApply(item, ticked)) {
    if (field.field === 'name') changes.name = entry.milestone.name;
    if (field.field === 'requiresClientApproval') {
      changes.requiresClientApproval = entry.milestone.requiresClientApproval;
    }
    // A stage the update did not create leaves the milestone where it is.
    if (field.field === 'stage' && stageId) changes.stageId = stageId;
  }
  return changes;
}
