import type { TemplateMilestone } from '../workflows/workflow-template-definition';
import {
  type SnapshotMilestone,
  type TemplateFieldChange,
  type TemplateItemChange,
  type TemplateUpdateInput,
  templateItemKey,
} from './template-update.types';
import {
  holdTemplateChanges,
  includedTemplateStages,
  indexByTemplateKey,
  templateMilestonesByKey,
  templateValueChange,
} from './template-update-fields';

interface MilestoneContext {
  readonly previous: ReturnType<typeof templateMilestonesByKey>;
  readonly stageKeyById: ReadonlyMap<string, string | null>;
  /** Stages that cannot take new work (closed, or an addition that is blocked). */
  readonly closedStageKeys: ReadonlySet<string>;
}

function stageKeyOf(context: MilestoneContext, milestone: SnapshotMilestone): string | null {
  return milestone.stageId ? (context.stageKeyById.get(milestone.stageId) ?? null) : null;
}

function addedMilestone(
  context: MilestoneContext,
  milestone: TemplateMilestone,
  stageKey: string,
): TemplateItemChange {
  return {
    key: templateItemKey('milestone', milestone.key),
    kind: 'milestone',
    change: 'added',
    templateKey: milestone.key,
    itemId: null,
    name: milestone.name,
    stageKey,
    status: null,
    fields: [],
    dates: null,
    optIn: null,
    blocked: context.closedStageKeys.has(stageKey)
      ? { reason: 'Its stage cannot take new work.' }
      : null,
  };
}

function changedMilestone(
  context: MilestoneContext,
  milestone: TemplateMilestone,
  stageKey: string,
  existing: SnapshotMilestone,
): TemplateItemChange | null {
  const before = context.previous.get(milestone.key);
  const fields = [
    templateValueChange('name', before?.milestone.name, milestone.name, existing.name),
    templateValueChange(
      'requiresClientApproval',
      before?.milestone.requiresClientApproval,
      milestone.requiresClientApproval,
      existing.requiresClientApproval,
    ),
    templateValueChange('stage', before?.stageKey, stageKey, stageKeyOf(context, existing)),
  ].filter((field): field is TemplateFieldChange => field !== null);
  if (fields.length === 0) return null;
  const completed = existing.status === 'completed';
  return {
    key: templateItemKey('milestone', milestone.key),
    kind: 'milestone',
    change: 'changed',
    templateKey: milestone.key,
    itemId: existing.id,
    name: existing.name,
    stageKey,
    status: existing.status,
    fields: completed ? holdTemplateChanges(fields) : fields,
    dates: null,
    optIn: null,
    blocked: completed ? { reason: 'This milestone is complete and stays as recorded.' } : null,
  };
}

function removedMilestone(
  context: MilestoneContext,
  existing: SnapshotMilestone,
  templateKey: string,
): TemplateItemChange {
  return {
    key: templateItemKey('milestone', templateKey),
    kind: 'milestone',
    change: 'removed',
    templateKey,
    itemId: existing.id,
    name: existing.name,
    stageKey: stageKeyOf(context, existing),
    status: existing.status,
    fields: [],
    dates: null,
    optIn: null,
    blocked:
      existing.status === 'completed'
        ? { reason: 'It is complete and stays in the record.' }
        : null,
  };
}

/** Milestones the new version adds, changes or drops. Completed milestones never change. */
export function diffMilestones(
  input: TemplateUpdateInput,
  closedStageKeys: ReadonlySet<string>,
): { items: TemplateItemChange[]; unchanged: number } {
  const { project } = input;
  const context: MilestoneContext = {
    previous: templateMilestonesByKey(input.from),
    stageKeyById: new Map(project.stages.map((stage) => [stage.id, stage.templateKey])),
    closedStageKeys,
  };
  const current = indexByTemplateKey(project.milestones);
  const items: TemplateItemChange[] = [];
  const kept = new Set<string>();
  let unchanged = 0;
  for (const stage of includedTemplateStages(input.to, project.templateOptions)) {
    for (const milestone of stage.milestones) {
      kept.add(milestone.key);
      const existing = current.get(milestone.key);
      if (!existing) {
        items.push(addedMilestone(context, milestone, stage.key));
      } else if (existing.status !== 'cancelled') {
        const change = changedMilestone(context, milestone, stage.key, existing);
        if (change) items.push(change);
        else unchanged += 1;
      }
    }
  }
  for (const existing of project.milestones) {
    const key = existing.templateKey;
    if (key === null || kept.has(key) || existing.status === 'cancelled') continue;
    items.push(removedMilestone(context, existing, key));
  }
  return { items, unchanged };
}
