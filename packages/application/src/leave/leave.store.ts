import type { DayPortion, LeaveStatus, LeaveTaskFact, LeaveTypeRules } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';

export interface LeaveTypeRecord extends LeaveTypeRules {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly colorIndex: number;
  readonly isActive: boolean;
}

export type ApprovalStepStatus = 'waiting' | 'pending' | 'approved' | 'rejected' | 'skipped';
export type HandoverStatus = 'proposed' | 'accepted' | 'declined' | 'applied';

export interface LeaveStepRecord {
  readonly id: string;
  readonly level: number;
  readonly approverUserId: string | null;
  readonly status: ApprovalStepStatus;
}

export interface LeaveHandoverRecord {
  readonly id: string;
  readonly leaveRequestId: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly projectId: string;
  readonly projectManagerUserId: string;
  readonly toUserId: string | null;
  readonly status: HandoverStatus;
}

/** The dates and status of a request: enough for overlaps, balances and absences. */
export interface LeavePeriodRecord {
  readonly id: string;
  readonly userId: string;
  readonly leaveTypeId: string;
  readonly startDate: CalendarDate;
  readonly endDate: CalendarDate;
  readonly dayPortion: DayPortion;
  readonly halfDayUnits: number;
  readonly status: LeaveStatus;
}

export interface LeaveRequestRecord extends LeavePeriodRecord {
  readonly reason: string | null;
  readonly isUrgentAbsence: boolean;
  readonly recordedByUserId: string | null;
  readonly version: number;
  readonly steps: readonly LeaveStepRecord[];
  readonly handovers: readonly LeaveHandoverRecord[];
}

export interface TeamAbsenceRecord extends LeavePeriodRecord {
  readonly fullName: string;
}

/** An open task of the person on leave, with the manager who must re-plan it. */
export interface LeaveWorkItem extends LeaveTaskFact {
  readonly projectManagerUserId: string;
}

export interface ConflictSnapshot {
  readonly capturedAt: string;
  readonly hasCritical: boolean;
  readonly taskConflicts: readonly {
    taskId: string;
    title: string;
    severity: string;
    explanation: string;
  }[];
}

export interface NewLeaveRequest {
  readonly userId: string;
  readonly leaveTypeId: string;
  readonly startDate: CalendarDate;
  readonly endDate: CalendarDate;
  readonly dayPortion: DayPortion;
  readonly halfDayUnits: number;
  readonly reason: string | null;
  readonly status: LeaveStatus;
  readonly isUrgentAbsence: boolean;
  readonly recordedByUserId: string | null;
  readonly warnings: readonly string[];
  readonly conflictSnapshot: ConflictSnapshot;
  readonly decidedAt: Date | null;
}

export interface NewLeaveStep {
  readonly level: number;
  readonly approverUserId: string | null;
  readonly status: ApprovalStepStatus;
  readonly decidedByUserId?: string | null;
  readonly decidedAt?: Date | null;
  readonly note?: string | null;
}

export interface NewHandover {
  readonly taskId: string;
  readonly toUserId: string | null;
  readonly note: string | null;
}

export interface LeaveRequestChange {
  readonly status?: LeaveStatus;
  readonly reason?: string | null;
  readonly decisionNote?: string | null;
  readonly decidedAt?: Date | null;
  readonly cancelledAt?: Date | null;
  readonly warnings?: readonly string[];
  readonly conflictSnapshot?: ConflictSnapshot;
}

export interface LeaveStepChange {
  readonly status: ApprovalStepStatus;
  readonly decidedByUserId?: string | null;
  readonly decidedAt?: Date | null;
  readonly note?: string | null;
}

export interface HandoverChange {
  readonly status: HandoverStatus;
  readonly toUserId?: string | null;
  readonly decidedByUserId: string;
  readonly decidedAt: Date;
}

/** Who can approve when the person's own manager cannot. */
export interface ApproverDirectory {
  readonly ownerUserId: string | null;
  /** Active non-owner people whose role holds `leave.approve_any`, administrators first. */
  readonly delegateUserIds: readonly string[];
}

export interface HandoverTaskRecord {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly ownerUserId: string | null;
  readonly version: number;
}

/** Persistence for leave requests, their approval steps and proposed handovers. */
export interface LeaveStore {
  findLeaveType(leaveTypeId: string): Promise<LeaveTypeRecord | null>;
  activeLeaveTypes(): Promise<LeaveTypeRecord[]>;
  findRequest(requestId: string): Promise<LeaveRequestRecord | null>;
  findHandover(handoverId: string): Promise<LeaveHandoverRecord | null>;
  /** The person's requests in the given statuses whose dates touch the range. */
  personRequests(
    userId: string,
    range: { start: CalendarDate; end: CalendarDate },
    statuses: readonly LeaveStatus[],
  ): Promise<LeavePeriodRecord[]>;
  /** Pending, info-requested and approved leave of teammates or people with the same manager. */
  teamAbsences(input: {
    userId: string;
    teamId: string | null;
    reportsToUserId: string | null;
    start: CalendarDate;
    end: CalendarDate;
  }): Promise<TeamAbsenceRecord[]>;
  /** Open, non-archived tasks the person owns. */
  openTasksOf(userId: string): Promise<LeaveWorkItem[]>;
  approverDirectory(): Promise<ApproverDirectory>;
  createRequest(input: NewLeaveRequest): Promise<{ id: string }>;
  addSteps(requestId: string, steps: readonly NewLeaveStep[]): Promise<void>;
  addHandovers(requestId: string, handovers: readonly NewHandover[]): Promise<void>;
  /** Removes handovers that were not applied yet (used when the requester revises them). */
  removeUnappliedHandovers(requestId: string): Promise<void>;
  /** Applies the change and bumps the version only if `expectedVersion` still matches. */
  updateRequest(
    requestId: string,
    expectedVersion: number,
    change: LeaveRequestChange,
  ): Promise<boolean>;
  updateStep(stepId: string, change: LeaveStepChange): Promise<void>;
  updateHandover(handoverId: string, change: HandoverChange): Promise<void>;
  handoverTask(taskId: string): Promise<HandoverTaskRecord | null>;
  /** Reassigns the task owner if the task version still matches. */
  reassignTaskOwner(taskId: string, expectedVersion: number, ownerUserId: string): Promise<boolean>;
  /** Adds the person as a project member when they are not one yet. */
  ensureProjectMember(projectId: string, userId: string): Promise<void>;
}
