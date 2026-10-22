import { addDays, type CalendarDate, maxCalendarDate } from '@lintel/shared';

export type LeaveHandoverStatus = 'proposed' | 'accepted' | 'declined' | 'applied';

export interface HandoverOwnershipFacts {
  readonly status: LeaveHandoverStatus;
  /** Who the handover gave (or proposes to give) the task to. */
  readonly toUserId: string | null;
  /** The task's owner right now. */
  readonly taskOwnerUserId: string | null;
  /** The person on leave. */
  readonly absentUserId: string;
}

/**
 * An applied handover no longer describes the task once its owner changed
 * again afterwards (for example a reassignment request gave it back).
 */
export function isHandoverSuperseded(facts: HandoverOwnershipFacts): boolean {
  return facts.status === 'applied' && facts.taskOwnerUserId !== facts.toUserId;
}

/** Superseded, and the task is with the person on leave again: it needs cover once more. */
export function isHandedBack(facts: HandoverOwnershipFacts): boolean {
  return isHandoverSuperseded(facts) && facts.taskOwnerUserId === facts.absentUserId;
}

/**
 * Why a manager may not hand the task over now, or null when they may.
 * A handover is applied once; it opens again only when the task came back to
 * the person on leave.
 */
export function handoverApplyProblem(facts: HandoverOwnershipFacts): string | null {
  if (facts.status === 'applied' && !isHandedBack(facts)) {
    return 'This handover was already applied.';
  }
  return null;
}

/** Days ahead checked for absences when a task has no due date or is already overdue. */
export const AWAY_LOOKAHEAD_DAYS = 14;

/**
 * The days a new owner would carry a task: from the later of today and its
 * planned start, to its due date. Without a due date, or when it is overdue,
 * the next two weeks from that start.
 */
export function taskOwnershipWindow(
  task: { readonly plannedStartDate: CalendarDate | null; readonly dueDate: CalendarDate | null },
  today: CalendarDate,
): { start: CalendarDate; end: CalendarDate } {
  const start = task.plannedStartDate ? maxCalendarDate(today, task.plannedStartDate) : today;
  const end =
    task.dueDate && task.dueDate >= start ? task.dueDate : addDays(start, AWAY_LOOKAHEAD_DAYS - 1);
  return { start, end };
}
