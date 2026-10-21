import type { CalendarDate } from '@lintel/shared';
import { minutesOfDay } from '../calendar/working-week.rules';

/** The current moment in the business timezone: its calendar date and wall-clock "HH:mm". */
export interface BusinessMoment {
  readonly date: CalendarDate;
  readonly time: string;
}

/**
 * When a task falls due on its due date: its own due time ("HH:mm", business
 * timezone) when one is set, otherwise the end of the working day.
 */
export function deadlineTimeOf(dueTime: string | null, dayEndTime: string): string {
  return dueTime ?? dayEndTime;
}

/** True once the deadline has gone by: a later day, or later than the deadline time that day. */
export function isDeadlinePassed(
  dueDate: CalendarDate,
  dueTime: string | null,
  now: BusinessMoment,
  dayEndTime: string,
): boolean {
  if (now.date !== dueDate) return now.date > dueDate;
  return now.time > deadlineTimeOf(dueTime, dayEndTime);
}

/** Minutes from `now` until a deadline later the same day (0 or less once it has passed). */
export function minutesUntilDeadlineToday(
  dueTime: string | null,
  now: BusinessMoment,
  dayEndTime: string,
): number {
  const deadline = minutesOfDay(deadlineTimeOf(dueTime, dayEndTime)) ?? 24 * 60;
  const current = minutesOfDay(now.time) ?? 0;
  return deadline - current;
}

/** "11:00" → "11:00"; null → "the end of the day". Used in plain-language explanations. */
export function describeDeadlineTime(dueTime: string | null): string {
  return dueTime ? `at ${dueTime}` : 'by the end of the day';
}
