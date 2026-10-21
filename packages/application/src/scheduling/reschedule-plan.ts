import { planTaskReschedule, type RescheduledTask, type WorkingCalendar } from '@lintel/domain';
import { type CalendarDate, isCalendarDate, ValidationFailedError } from '@lintel/shared';
import type { ProjectScheduleFacts } from '../scope-changes/scope-change.store';
import type { TaskDateRequest } from '../scope-changes/scope-change-additions';
import { taskDateChangeIssues, toTaskDateChanges } from '../scope-changes/scope-change-exact-dates';

export interface PreviewedMove extends RescheduledTask {
  /** The task is no longer a draft and its due date moves: a committed deadline. */
  readonly committed: boolean;
}

export interface SlippingMilestone {
  readonly id: string;
  readonly name: string;
  readonly dueDate: string;
  /** The latest due date of its open tasks once the moves apply. */
  readonly latestTaskDueDate: string;
}

export interface ReschedulePreview {
  readonly moves: PreviewedMove[];
  readonly plannedEndDate: string;
  readonly forecastEndDate: string | null;
  readonly projectEndImpactDays: number;
  /** The agreed end date would move: propose a scope change instead of moving directly. */
  readonly requiresScopeChange: boolean;
  /** A committed deadline moves, so the move needs a reason for the history. */
  readonly needsReason: boolean;
  readonly slippingMilestones: SlippingMilestone[];
}

/** At most this many bars change in one go (a drag moves one; the keyboard may batch). */
export const MAX_RESCHEDULE_CHANGES = 20;

function asDate(value: string | null): CalendarDate | null {
  return value && isCalendarDate(value) ? value : null;
}

function slipping(
  facts: ProjectScheduleFacts,
  moves: readonly RescheduledTask[],
): SlippingMilestone[] {
  const proposed = new Map(moves.map((move) => [move.taskId, move.proposedDueDate as string]));
  return facts.milestones.flatMap((milestone): SlippingMilestone[] => {
    if (milestone.status !== 'pending') return [];
    const linked = facts.tasks.filter(
      (task) => task.milestoneId === milestone.id && proposed.has(task.id),
    );
    const latest = linked
      .map((task) => proposed.get(task.id) ?? '')
      .reduce((max, due) => (due > max ? due : max), '');
    return latest > milestone.dueDate
      ? [
          {
            id: milestone.id,
            name: milestone.name,
            dueDate: milestone.dueDate,
            latestTaskDueDate: latest,
          },
        ]
      : [];
  });
}

/**
 * Checks the requested dates and works out their knock-on effect with the
 * domain rule, plus what that means for the project's commitments.
 */
export function previewReschedule(
  facts: ProjectScheduleFacts,
  changes: readonly TaskDateRequest[],
  calendar: WorkingCalendar,
): ReschedulePreview {
  if (changes.length === 0 || changes.length > MAX_RESCHEDULE_CHANGES) {
    throw new ValidationFailedError(
      `Move between 1 and ${MAX_RESCHEDULE_CHANGES} tasks at a time.`,
      [
        {
          field: 'changes',
          message: `Move between 1 and ${MAX_RESCHEDULE_CHANGES} tasks at a time.`,
        },
      ],
    );
  }
  const issues = taskDateChangeIssues(facts, changes, 0).map((issue) => ({
    ...issue,
    field: issue.field?.replace('taskDateChanges', 'changes') ?? 'changes',
  }));
  if (issues.length > 0) throw new ValidationFailedError('Some dates cannot be used.', issues);
  const plannedEnd = asDate(facts.plannedEndDate) ?? ('9999-12-31' as CalendarDate);
  const plan = planTaskReschedule({
    tasks: facts.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      plannedStartDate: asDate(task.plannedStartDate),
      dueDate: asDate(task.dueDate),
    })),
    dependencies: facts.dependencies,
    changes: toTaskDateChanges(changes),
    calendar,
    plannedEndDate: plannedEnd,
  });
  const moves = plan.moves.map((move) => ({
    ...move,
    committed: move.status !== 'draft' && move.proposedDueDate !== move.currentDueDate,
  }));
  return {
    moves,
    plannedEndDate: facts.plannedEndDate,
    forecastEndDate: plan.forecastEndDate,
    projectEndImpactDays: plan.projectEndImpactDays,
    requiresScopeChange: plan.projectEndImpactDays > 0,
    needsReason: moves.some((move) => move.committed),
    slippingMilestones: slipping(facts, plan.moves),
  };
}
