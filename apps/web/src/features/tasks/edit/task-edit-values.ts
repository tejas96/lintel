import type { TaskDetail } from '@lintel/api-contracts';
import type { TaskPriority } from '@lintel/domain';

/** The edit form as typed; numbers stay text until the person is done typing. */
export interface TaskEditValues {
  readonly title: string;
  readonly description: string;
  readonly completionCriteria: string;
  readonly plannedStartDate: string | null;
  readonly dueDate: string | null;
  readonly estimateHours: string;
  readonly priority: TaskPriority;
  readonly requiresReview: boolean;
  readonly escalateAfterOverdueDays: string;
  readonly scheduleChangeReason: string;
}

export interface TaskEditChanges {
  title?: string;
  description?: string | null;
  completionCriteria?: string | null;
  plannedStartDate?: string | null;
  dueDate?: string | null;
  estimateMinutes?: number | null;
  priority?: TaskPriority;
  requiresReview?: boolean;
  escalateAfterOverdueDays?: number;
}

function hoursText(minutes: number | null): string {
  if (minutes === null) return '';
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0+$/, '');
}

export function editValuesOf(task: TaskDetail): TaskEditValues {
  return {
    title: task.title,
    description: task.description ?? '',
    completionCriteria: task.completionCriteria ?? '',
    plannedStartDate: task.plannedStartDate,
    dueDate: task.dueDate,
    estimateHours: hoursText(task.estimateMinutes),
    priority: task.priority,
    requiresReview: task.requiresReview,
    // 0 (from older templates) behaves like 1: the next working day.
    escalateAfterOverdueDays: String(Math.max(1, task.escalateAfterOverdueDays)),
    scheduleChangeReason: '',
  };
}

const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

function estimateMinutesOf(values: TaskEditValues): number | null {
  const text = values.estimateHours.trim().replace(',', '.');
  return text === '' ? null : Math.round(Number(text) * 60);
}

/** A committed due date (anything past draft) moves only with a recorded reason. */
export function dueDateMoves(task: TaskDetail, values: TaskEditValues): boolean {
  return task.status !== 'draft' && values.dueDate !== task.dueDate;
}

/** Only what changed, so a save never overwrites someone else's edit by accident. */
export function changesOf(task: TaskDetail, values: TaskEditValues): TaskEditChanges {
  const changes: TaskEditChanges = {};
  if (values.title.trim() !== task.title) changes.title = values.title.trim();
  if (orNull(values.description) !== task.description)
    changes.description = orNull(values.description);
  if (orNull(values.completionCriteria) !== task.completionCriteria)
    changes.completionCriteria = orNull(values.completionCriteria);
  if (values.plannedStartDate !== task.plannedStartDate)
    changes.plannedStartDate = values.plannedStartDate;
  if (values.dueDate !== task.dueDate) changes.dueDate = values.dueDate;
  const estimate = estimateMinutesOf(values);
  if (estimate !== task.estimateMinutes) changes.estimateMinutes = estimate;
  if (values.priority !== task.priority) changes.priority = values.priority;
  if (values.requiresReview !== task.requiresReview) changes.requiresReview = values.requiresReview;
  const days = Number(values.escalateAfterOverdueDays);
  if (days !== Math.max(1, task.escalateAfterOverdueDays)) changes.escalateAfterOverdueDays = days;
  return changes;
}

/** Checks the form before sending (the server checks again); keys match the API's fields. */
export function checkTaskEdit(task: TaskDetail, values: TaskEditValues) {
  const errors: Record<string, string> = {};
  if (values.title.trim().length < 1) errors.title = 'Give the task a title.';
  const estimate = values.estimateHours.trim().replace(',', '.');
  const hours = Number(estimate);
  if (estimate !== '' && (!Number.isFinite(hours) || hours < 0 || hours > 1600)) {
    errors.estimateMinutes = 'Use hours, for example 2 or 1.5.';
  }
  const days = Number(values.escalateAfterOverdueDays);
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    errors.escalateAfterOverdueDays = 'Use a whole number of working days from 1 to 30.';
  }
  if (values.plannedStartDate && values.dueDate && values.plannedStartDate > values.dueDate) {
    errors.plannedStartDate = 'Start on or before the due date.';
  }
  if (dueDateMoves(task, values)) {
    if (values.dueDate === null && task.status !== 'done' && task.status !== 'cancelled') {
      errors.dueDate = 'Choose a date instead of clearing it.';
    }
    if (values.scheduleChangeReason.trim().length < 3) {
      errors.scheduleChangeReason = 'Say why the committed date moves. It stays in the history.';
    }
  }
  return errors;
}
