import { type CalendarDate, daysBetween, spokenTimeOfDay } from '@lintel/shared';
import {
  type BusinessMoment,
  deadlineTimeOf,
  isDeadlinePassed,
  minutesUntilDeadlineToday,
} from './task-deadline';

/** What the planner knows about "now" beyond the date: the clock time and the day's end. */
export interface PriorityClock {
  readonly now: BusinessMoment;
  /** End of the person's working day ("HH:mm"): the deadline of tasks without a due time. */
  readonly dayEndTime: string;
}

export interface DeadlineFacts {
  readonly dueDate: CalendarDate | null;
  readonly dueTime: string | null;
}

export interface DeadlineSignal {
  readonly code: string;
  readonly points: number;
  readonly explanation: string;
}

/** A deadline later today this close (in minutes) earns a little more urgency. */
export const DUE_WITHIN_HOURS_MINUTES = 120;

function at(dueTime: string | null): string {
  return dueTime ? ` at ${spokenTimeOfDay(dueTime)}` : '';
}

/**
 * True when the task's deadline has passed. With a clock, a task due today
 * is overdue once its due time (or the end of the working day) has gone by;
 * without one, only from the next day.
 */
export function isOverdueAt(
  task: DeadlineFacts,
  today: CalendarDate,
  clock: PriorityClock | undefined,
): boolean {
  if (task.dueDate === null) return false;
  if (!clock) return task.dueDate < today;
  return isDeadlinePassed(task.dueDate, task.dueTime, clock.now, clock.dayEndTime);
}

function sameDaySignal(task: DeadlineFacts, clock: PriorityClock | undefined): DeadlineSignal {
  if (clock && task.dueTime) {
    const left = minutesUntilDeadlineToday(task.dueTime, clock.now, clock.dayEndTime);
    if (left <= DUE_WITHIN_HOURS_MINUTES) {
      return {
        code: 'DUE_WITHIN_HOURS',
        points: 34,
        explanation: `It is due at ${spokenTimeOfDay(task.dueTime)} today, in under ${left <= 60 ? 'an hour' : '2 hours'}.`,
      };
    }
  }
  return { code: 'DUE_TODAY', points: 30, explanation: `It is due today${at(task.dueTime)}.` };
}

/** Points and words for how close the deadline is; null when it is more than a week away. */
export function deadlineSignal(
  task: DeadlineFacts,
  today: CalendarDate,
  clock?: PriorityClock,
): DeadlineSignal | null {
  if (task.dueDate === null) return null;
  const daysLeft = daysBetween(today, task.dueDate);
  if (daysLeft < 0) {
    const late = -daysLeft;
    const points = 35 + Math.min(late * 2, 10);
    return { code: 'OVERDUE', points, explanation: `It is ${late} day(s) overdue.` };
  }
  if (daysLeft === 0) {
    if (isOverdueAt(task, today, clock)) {
      const when = task.dueTime
        ? `at ${spokenTimeOfDay(task.dueTime)}`
        : 'by the end of the working day';
      return { code: 'OVERDUE', points: 35, explanation: `It was due today ${when}.` };
    }
    return sameDaySignal(task, clock);
  }
  if (daysLeft === 1) {
    return {
      code: 'DUE_TOMORROW',
      points: 22,
      explanation: `It is due tomorrow${at(task.dueTime)}.`,
    };
  }
  if (daysLeft <= 3) {
    return { code: 'DUE_SOON', points: 15, explanation: `It is due in ${daysLeft} days.` };
  }
  if (daysLeft <= 7) {
    return { code: 'DUE_THIS_WEEK', points: 8, explanation: `It is due in ${daysLeft} days.` };
  }
  return null;
}

/** Sort key for ties: the due date, then the time it falls due ("23:59" for no date). */
export function deadlineSortKey(task: DeadlineFacts, clock: PriorityClock | undefined): string {
  if (task.dueDate === null) return '9999-12-31T23:59';
  return `${task.dueDate}T${deadlineTimeOf(task.dueTime, clock?.dayEndTime ?? '23:59')}`;
}
