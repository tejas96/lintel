import { type CalendarDate, zonedTimeToInstant } from '@lintel/shared';
import type { WorkingCalendar } from '../calendar/working-calendar';
import { nextWorkingDayAfter } from '../calendar/working-moments';
import type { TaskStatus } from './task-status';

export interface LateStartInput {
  readonly status: TaskStatus;
  readonly ownerUserId: string | null;
  readonly plannedStartDate: CalendarDate | null;
  readonly dueDate: CalendarDate | null;
  /** Every prerequisite is done, so nothing but the owner stops the work from starting. */
  readonly prerequisitesDone: boolean;
  /** The task owner's calendar. */
  readonly calendar: WorkingCalendar;
  /** "HH:mm" studio reminder time (the same as the deadline reminder). */
  readonly reminderTime: string;
}

export interface LateStartNudge {
  readonly at: Date;
  /** The planned start the nudge is about; a new start date makes a new nudge. */
  readonly plannedStartDate: CalendarDate;
}

/**
 * The late-start nudge: on the working day after the planned start, at the
 * studio reminder time, the owner of a task that is still Ready is asked to
 * start it, report a blocker or ask for a new date. There is no nudge when:
 * the task has no owner or no planned start; it is a draft (not committed),
 * already started or closed; a prerequisite is still open (the delay belongs
 * to that task, which has its own timeline); or the nudge would come after
 * the due date (the overdue alert covers it).
 */
export function planLateStartNudge(input: LateStartInput): LateStartNudge | null {
  if (input.status !== 'ready' || input.ownerUserId === null) return null;
  if (input.plannedStartDate === null || !input.prerequisitesDone) return null;
  const day = nextWorkingDayAfter(input.calendar, input.plannedStartDate);
  if (input.dueDate !== null && day > input.dueDate) return null;
  return {
    at: zonedTimeToInstant(day, input.reminderTime, input.calendar.timeZone),
    plannedStartDate: input.plannedStartDate,
  };
}

/** True when a task that could start has passed its planned start without starting. */
export function isLateToStart(
  task: Pick<LateStartInput, 'status' | 'plannedStartDate'>,
  today: CalendarDate,
): boolean {
  return (
    (task.status === 'ready' || task.status === 'draft') &&
    task.plannedStartDate !== null &&
    task.plannedStartDate < today
  );
}
