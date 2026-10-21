import type { TemplateStage } from '../workflows/workflow-template-definition';
import {
  type SnapshotStage,
  type TemplateFieldChange,
  type TemplateItemChange,
  type TemplateUpdateInput,
  templateItemKey,
} from './template-update.types';
import {
  holdTemplateChanges,
  includedTemplateStages,
  indexByTemplateKey,
  templateStagesByKey,
  templateValueChange,
} from './template-update-fields';

const STAGE_STARTED = 'This stage has started. Tick to update it anyway.';

function isStarted(stage: SnapshotStage): boolean {
  return stage.status === 'active' || stage.status === 'completed';
}

/**
 * Where an added stage would sit: right after the nearest earlier template
 * stage the project has. It cannot go in front of a stage that has started,
 * because stages only ever move forward.
 */
function insertionBlocked(
  stage: TemplateStage,
  newOrder: readonly TemplateStage[],
  project: readonly SnapshotStage[],
): boolean {
  const present = indexByTemplateKey(project);
  const index = newOrder.findIndex((candidate) => candidate.key === stage.key);
  const anchor = newOrder
    .slice(0, index)
    .reverse()
    .find((candidate) => present.has(candidate.key));
  const anchorPosition = anchor ? (present.get(anchor.key)?.position ?? -1) : -1;
  return project.some((existing) => existing.position > anchorPosition && isStarted(existing));
}

export interface StageDiff {
  readonly items: TemplateItemChange[];
  readonly unchanged: number;
  /** Template keys of stages whose addition is blocked (their tasks cannot be added either). */
  readonly blockedStageKeys: ReadonlySet<string>;
}

function addedStage(stage: TemplateStage, blocked: boolean): TemplateItemChange {
  return {
    key: templateItemKey('stage', stage.key),
    kind: 'stage',
    change: 'added',
    templateKey: stage.key,
    itemId: null,
    name: stage.name,
    stageKey: stage.key,
    status: null,
    fields: [],
    dates: null,
    optIn: null,
    blocked: blocked ? { reason: 'It would come before stages that have already started.' } : null,
  };
}

function changedStage(
  stage: TemplateStage,
  previous: TemplateStage | undefined,
  existing: SnapshotStage,
): TemplateItemChange | null {
  const fields = [
    templateValueChange('name', previous?.name, stage.name, existing.name),
    templateValueChange(
      'description',
      previous ? (previous.description ?? null) : undefined,
      stage.description ?? null,
      existing.description,
    ),
  ].filter((field): field is TemplateFieldChange => field !== null);
  if (fields.length === 0) return null;
  const started = isStarted(existing);
  const shown = started ? holdTemplateChanges(fields) : fields;
  return {
    key: templateItemKey('stage', stage.key),
    kind: 'stage',
    change: 'changed',
    templateKey: stage.key,
    itemId: existing.id,
    name: existing.name,
    stageKey: stage.key,
    status: existing.status,
    fields: shown,
    dates: null,
    optIn: shown.some((field) => field.outcome === 'held') ? { reason: STAGE_STARTED } : null,
    blocked: null,
  };
}

function removedStage(existing: SnapshotStage, templateKey: string): TemplateItemChange {
  return {
    key: templateItemKey('stage', templateKey),
    kind: 'stage',
    change: 'removed',
    templateKey,
    itemId: existing.id,
    name: existing.name,
    stageKey: templateKey,
    status: existing.status,
    fields: [],
    dates: null,
    optIn: null,
    blocked: isStarted(existing)
      ? {
          reason:
            'This stage has started, so it stays. Its unstarted tasks can still be cancelled.',
        }
      : null,
  };
}

/** Stages the new version adds, renames or drops, measured against the project's own stages. */
export function diffStages(input: TemplateUpdateInput): StageDiff {
  const { project } = input;
  const nextStages = includedTemplateStages(input.to, project.templateOptions);
  const previous = templateStagesByKey(input.from);
  const current = indexByTemplateKey(project.stages);
  const items: TemplateItemChange[] = [];
  const blockedStageKeys = new Set<string>();
  let unchanged = 0;
  for (const stage of nextStages) {
    const existing = current.get(stage.key);
    if (!existing) {
      const blocked = insertionBlocked(stage, nextStages, project.stages);
      if (blocked) blockedStageKeys.add(stage.key);
      items.push(addedStage(stage, blocked));
    } else if (existing.status !== 'skipped') {
      const change = changedStage(stage, previous.get(stage.key), existing);
      if (change) items.push(change);
      else unchanged += 1;
    }
  }
  const kept = new Set(nextStages.map((stage) => stage.key));
  for (const existing of project.stages) {
    const key = existing.templateKey;
    if (key === null || kept.has(key) || existing.status === 'skipped') continue;
    items.push(removedStage(existing, key));
  }
  return { items, unchanged, blockedStageKeys };
}
