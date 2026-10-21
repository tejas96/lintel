import { spokenTimeOfDay } from '@lintel/shared';
import { daysBetween, describeDue } from './dates';

/** "14:30" → "2:30 pm" (studio wall-clock time), the same words the server uses. */
export const formatTimeOfDay = spokenTimeOfDay;

export interface TaskDueFacts {
  readonly dueDate: string | null;
  readonly dueTime: string | null;
  /** From the server: true once the due time (or the working day) has passed. */
  readonly isOverdue: boolean;
}

export interface DueLabel {
  readonly text: string;
  readonly late: boolean;
  readonly soon: boolean;
}

/**
 * The due wording for a task, with its time when one is set: "Due 11:00 am
 * today", "Was due 11:00 am", "Due 11:00 am tomorrow", "Due in 3 days,
 * 11:00 am". Without a time the deadline is the end of the working day.
 */
export function describeTaskDue(task: TaskDueFacts, today: string): DueLabel | null {
  if (!task.dueDate) return null;
  const base = describeDue(task.dueDate, today);
  const days = daysBetween(today, task.dueDate);
  if (days < 0) return base;
  if (!task.dueTime) return days === 0 && task.isOverdue ? { ...base, late: true } : base;
  const time = formatTimeOfDay(task.dueTime);
  if (days === 0) {
    return task.isOverdue
      ? { text: `Was due ${time}`, late: true, soon: false }
      : { text: `Due ${time} today`, late: false, soon: true };
  }
  if (days === 1) return { text: `Due ${time} tomorrow`, late: false, soon: true };
  return { ...base, text: `${base.text}, ${time}` };
}
