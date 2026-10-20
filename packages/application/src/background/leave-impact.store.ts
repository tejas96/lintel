import type { DayPortion, LeaveStatus, LeaveTaskFact } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';

export interface LeaveRequestFacts {
  readonly id: string;
  readonly userId: string;
  readonly fullName: string;
  readonly startDate: CalendarDate;
  readonly endDate: CalendarDate;
  readonly dayPortion: DayPortion;
  readonly status: LeaveStatus;
  readonly isUrgentAbsence: boolean;
}

/** An open task of the absent person, with the manager who must reassess it. */
export interface LeaveTaskImpactFact extends LeaveTaskFact {
  readonly managerUserId: string;
}

export interface PendingHandoverFact {
  readonly handoverId: string;
  readonly taskId: string;
  readonly title: string;
  readonly projectName: string;
  readonly managerUserId: string;
  readonly status: 'proposed' | 'accepted' | 'declined';
  readonly toUserName: string | null;
}

/** Facts for reassessing work when someone is away. Nothing here reassigns work. */
export interface LeaveImpactStore {
  leaveRequest(leaveRequestId: string): Promise<LeaveRequestFacts | null>;
  openTasksOwnedBy(userId: string): Promise<LeaveTaskImpactFact[]>;
  handoversNotApplied(leaveRequestId: string): Promise<PendingHandoverFact[]>;
}
