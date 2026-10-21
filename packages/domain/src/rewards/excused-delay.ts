import { addDays, type CalendarDate, eachCalendarDate } from '@lintel/shared';
import { isWorkingDay, type WorkingCalendar } from '../calendar/working-calendar';

/** Waiting on a client, a supplier or a manager's decision is outside anyone's control. */
export const EXTERNAL_DELAY_CATEGORIES: ReadonlySet<string> = new Set([
  'client',
  'supplier',
  'manager_decision',
]);

/** A recorded blocker on the work, as calendar days in the studio timezone. */
export interface DelayBlockerFact {
  readonly category: string;
  /** The colleague the work waited on, when the blocker named one. */
  readonly waitingOnUserId: string | null;
  readonly raisedOn: CalendarDate;
  /** The day it was resolved, or the day the work finished when it never was. */
  readonly resolvedOn: CalendarDate;
}

/**
 * Outside the person's control: waiting on a client, a supplier, a manager's
 * decision, or a named colleague other than the person themself.
 */
export function isOutsidePersonsControl(blocker: DelayBlockerFact, userId: string): boolean {
  if (EXTERNAL_DELAY_CATEGORIES.has(blocker.category)) return true;
  return blocker.waitingOnUserId !== null && blocker.waitingOnUserId !== userId;
}

/**
 * Working days (on the person's calendar) the work waited on blockers outside
 * the person's control. Overlapping blockers count once; the day a blocker is
 * resolved is not a waiting day.
 */
export function excusedWorkingDays(
  blockers: readonly DelayBlockerFact[],
  userId: string,
  calendar: WorkingCalendar,
): number {
  const waiting = new Set<CalendarDate>();
  for (const blocker of blockers) {
    if (!isOutsidePersonsControl(blocker, userId)) continue;
    if (blocker.resolvedOn <= blocker.raisedOn) continue;
    for (const date of eachCalendarDate(blocker.raisedOn, addDays(blocker.resolvedOn, -1))) {
      if (isWorkingDay(calendar, date)) waiting.add(date);
    }
  }
  return waiting.size;
}
