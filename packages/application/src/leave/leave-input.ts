import { type DayPortion, formatLeaveDuration, type LeavePeriod } from '@lintel/domain';
import { NotFoundError, toCalendarDate, ValidationFailedError } from '@lintel/shared';
import type { PersonRecord } from '../people/people.store';
import type { LeaveTypeRecord, NewHandover } from './leave.store';
import type { LeaveStores } from './leave-context';
import type { LeaveSummaryFacts } from './leave-notifications';

export interface LeavePeriodInput {
  readonly leaveTypeId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly dayPortion: DayPortion;
}

export interface HandoverInput {
  readonly taskId: string;
  readonly toUserId: string | null;
  readonly note: string | null;
}

export function periodOf(input: LeavePeriodInput): LeavePeriod {
  return {
    startDate: toCalendarDate(input.startDate),
    endDate: toCalendarDate(input.endDate),
    dayPortion: input.dayPortion,
  };
}

export async function requireLeaveType(
  stores: Pick<LeaveStores, 'leave'>,
  leaveTypeId: string,
): Promise<LeaveTypeRecord> {
  const type = await stores.leave.findLeaveType(leaveTypeId);
  if (!type) throw new NotFoundError('Leave type');
  return type;
}

/** Stops a submission with every blocking problem listed. */
export function assertNoBlockingProblems(problems: readonly string[]): void {
  const [first] = problems;
  if (first === undefined) return;
  throw new ValidationFailedError(
    first,
    problems.map((message) => ({ message })),
  );
}

/**
 * Handovers may only cover the requester's own open tasks, once each, and go
 * to another active person (or to nobody yet, leaving the choice to the manager).
 */
export async function validateHandovers(
  stores: Pick<LeaveStores, 'leave' | 'people'>,
  requesterId: string,
  handovers: readonly HandoverInput[],
): Promise<NewHandover[]> {
  if (handovers.length === 0) return [];
  const openTasks = new Set(
    (await stores.leave.openTasksOf(requesterId)).map((task) => task.taskId),
  );
  const seen = new Set<string>();
  for (const [index, handover] of handovers.entries()) {
    if (!openTasks.has(handover.taskId) || seen.has(handover.taskId)) {
      throw new ValidationFailedError('A handover must cover one of your open tasks, once.', [
        { field: `handovers.${index}.taskId`, message: 'Choose one of your open tasks.' },
      ]);
    }
    seen.add(handover.taskId);
    if (handover.toUserId === null) continue;
    const recipient = await stores.people.findById(handover.toUserId);
    if (recipient?.status !== 'active' || recipient.id === requesterId) {
      throw new ValidationFailedError('Choose an active colleague for the handover.', [
        { field: `handovers.${index}.toUserId`, message: 'Choose someone else who is active.' },
      ]);
    }
  }
  return handovers.map((handover) => ({
    taskId: handover.taskId,
    toUserId: handover.toUserId,
    note: handover.note,
  }));
}

export function summaryFacts(
  requestId: string,
  person: PersonRecord,
  type: LeaveTypeRecord,
  period: { startDate: string; endDate: string; halfDayUnits: number },
): LeaveSummaryFacts {
  return {
    requestId,
    personName: person.fullName,
    leaveTypeName: type.name,
    startDate: period.startDate,
    endDate: period.endDate,
    durationLabel: formatLeaveDuration(period.halfDayUnits),
  };
}
