import { isCalendarDate } from '@lintel/shared';
import { addWorkingDays } from '../calendar/working-calendar';
import type { TemplateTask } from '../workflows/workflow-template-definition';
import type {
  DateMove,
  SnapshotTask,
  TemplateFieldChange,
  TemplateUpdateInput,
} from './template-update.types';
import { templateListChange, templateValueChange } from './template-update-fields';

export interface TaskContext {
  readonly input: TemplateUpdateInput;
  readonly stageKeyById: ReadonlyMap<string, string | null>;
  readonly milestoneKeyById: ReadonlyMap<string, string | null>;
  readonly taskKeyById: ReadonlyMap<string, string | null>;
}

export function keyOf(map: ReadonlyMap<string, string | null>, id: string | null): string | null {
  return id === null ? null : (map.get(id) ?? null);
}

/** New dates when the template changes a task's duration: same start, new length. */
export function durationMove(
  context: TaskContext,
  task: SnapshotTask,
  previous: TemplateTask | undefined,
  next: TemplateTask,
): { field: TemplateFieldChange; dates: DateMove } | null {
  const before = previous?.durationDays;
  if (before === undefined || before === next.durationDays) return null;
  const start = task.plannedStartDate;
  if (start === null || !isCalendarDate(start)) return null;
  const due = addWorkingDays(context.input.calendar, start, next.durationDays - 1);
  if (due === task.dueDate) return null;
  const committed = task.baselineDueDate !== null;
  return {
    field: {
      field: 'duration',
      from: String(before),
      to: String(next.durationDays),
      added: [],
      removed: [],
      outcome: committed ? 'held' : 'apply',
    },
    dates: { fromStart: start, fromDue: task.dueDate, toStart: start, toDue: due },
  };
}

export function fieldChanges(
  context: TaskContext,
  task: SnapshotTask,
  previous: { task: TemplateTask; stageKey: string } | undefined,
  next: { task: TemplateTask; stageKey: string },
): TemplateFieldChange[] {
  const old = previous?.task;
  const now = next.task;
  const prerequisiteKeys = task.prerequisiteTaskIds
    .map((id) => keyOf(context.taskKeyById, id))
    .filter((key): key is string => key !== null);
  return [
    templateValueChange('title', old?.title, now.title, task.title),
    templateValueChange(
      'description',
      old ? (old.description ?? null) : undefined,
      now.description ?? null,
      task.description,
    ),
    templateValueChange('priority', old?.priority, now.priority, task.priority),
    templateValueChange(
      'requiresReview',
      old?.requiresReview,
      now.requiresReview,
      task.requiresReview,
    ),
    templateValueChange(
      'estimateMinutes',
      old ? (old.estimateMinutes ?? null) : undefined,
      now.estimateMinutes ?? null,
      task.estimateMinutes,
    ),
    templateValueChange(
      'escalateAfterOverdueDays',
      old ? (old.escalateAfterOverdueDays ?? 1) : undefined,
      now.escalateAfterOverdueDays ?? 1,
      task.escalateAfterOverdueDays,
    ),
    templateValueChange(
      'stage',
      previous?.stageKey,
      next.stageKey,
      keyOf(context.stageKeyById, task.stageId),
    ),
    templateValueChange(
      'milestone',
      old ? (old.milestoneKey ?? null) : undefined,
      now.milestoneKey ?? null,
      keyOf(context.milestoneKeyById, task.milestoneId),
    ),
    templateListChange('prerequisites', old?.dependsOn, now.dependsOn, prerequisiteKeys),
    templateListChange(
      'checklist',
      old?.checklist.map((item) => item.label),
      now.checklist.map((item) => item.label),
      task.checklistLabels,
    ),
    templateListChange(
      'deliverables',
      old?.deliverables.map((item) => item.name),
      now.deliverables.map((item) => item.name),
      task.deliverableNames,
    ),
  ].filter((field): field is TemplateFieldChange => field !== null);
}
