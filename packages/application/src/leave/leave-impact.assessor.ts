import {
  ACTIVE_LEAVE_STATUSES,
  createStandardLeaveApprovalPolicy,
  detectLeaveConflicts,
  formatLeaveDuration,
  type LeaveDay,
  type LeavePeriod,
  type LeaveTaskConflict,
  leaveDays,
  type TeamAbsenceFact,
  totalHalfDayUnits,
  validateLeavePeriod,
} from '@lintel/domain';
import {
  type CalendarDate,
  eachCalendarDate,
  maxCalendarDate,
  minCalendarDate,
  ValidationFailedError,
} from '@lintel/shared';
import type { PersonRecord } from '../people/people.store';
import type { LeaveTypeRecord, LeaveWorkItem, TeamAbsenceRecord } from './leave.store';
import { calendarYearOf, halfDaysWithinRange } from './leave-balance';
import { calendarOf, type LeaveStores } from './leave-context';

export interface LeaveImpactInput {
  readonly subject: PersonRecord;
  readonly leaveType: LeaveTypeRecord;
  readonly period: LeavePeriod;
  readonly reason: string | null;
  readonly isUrgentAbsence: boolean;
  /** The request being re-assessed, so it does not overlap itself. */
  readonly excludeRequestId: string | null;
  readonly today: CalendarDate;
}

export interface LeaveImpact {
  readonly days: readonly LeaveDay[];
  readonly halfDayUnits: number;
  readonly durationLabel: string;
  readonly conflicts: readonly LeaveTaskConflict[];
  readonly overlappingAbsences: readonly {
    userId: string;
    fullName: string;
    status: string;
    dates: CalendarDate[];
  }[];
  readonly warnings: readonly string[];
  readonly blockingProblems: readonly string[];
  readonly approvalLevels: 1 | 2;
  readonly hasCritical: boolean;
  /** Conflicting tasks with their project managers (for urgent absence reassessment). */
  readonly affectedWork: readonly LeaveWorkItem[];
}

function toAbsenceFact(
  absence: TeamAbsenceRecord,
  range: { start: CalendarDate; end: CalendarDate },
): TeamAbsenceFact {
  const start = maxCalendarDate(absence.startDate, range.start);
  const end = minCalendarDate(absence.endDate, range.end);
  return {
    userId: absence.userId,
    fullName: absence.fullName,
    status: absence.status === 'approved' ? 'approved' : 'pending',
    dates: eachCalendarDate(start, end),
  };
}

/**
 * Working days, affected work, team overlap and policy assessment for a leave
 * period. Uses the domain rules; conflicts inform the decision and never
 * reject leave on their own.
 */
export async function assessLeaveImpact(
  stores: Pick<LeaveStores, 'leave' | 'settings'>,
  input: LeaveImpactInput,
): Promise<LeaveImpact> {
  const periodProblems = validateLeavePeriod(input.period);
  if (periodProblems.length > 0) {
    throw new ValidationFailedError('Check the leave dates.', periodProblems);
  }
  const { subject, period } = input;
  const range = { start: period.startDate, end: period.endDate };
  // Sequential on purpose: inside a transaction every query shares one connection.
  const calendar = await calendarOf(stores.settings, subject.id);
  const settings = await stores.settings.organization();
  const sameYear = await stores.leave.personRequests(subject.id, calendarYearOf(period.startDate), [
    'approved',
  ]);
  const overlapping = await stores.leave.personRequests(subject.id, range, ACTIVE_LEAVE_STATUSES);
  const tasks = await stores.leave.openTasksOf(subject.id);
  const absences = await stores.leave.teamAbsences({
    userId: subject.id,
    teamId: subject.teamId,
    reportsToUserId: subject.reportsToUserId,
    ...range,
  });
  const days = leaveDays(period, calendar);
  const halfDayUnits = totalHalfDayUnits(days);
  const others = (request: { id: string }) => request.id !== input.excludeRequestId;
  const report = detectLeaveConflicts(
    days,
    tasks,
    absences.map((absence) => toAbsenceFact(absence, range)),
  );
  const policy = createStandardLeaveApprovalPolicy({
    secondApprovalAboveHalfDays: settings.leaveSecondApprovalAboveHalfDays,
  });
  const assessment = policy.assess(input.leaveType, {
    today: input.today,
    startDate: period.startDate,
    requestedHalfDays: halfDayUnits,
    usedHalfDaysThisYear: halfDaysWithinRange(
      sameYear.filter((request) => others(request) && request.leaveTypeId === input.leaveType.id),
      calendarYearOf(period.startDate),
      calendar,
    ),
    reason: input.reason,
    isHalfDay: period.dayPortion !== 'full',
    isUrgentAbsence: input.isUrgentAbsence,
    overlapsExistingRequest: overlapping.some(others),
    hasCriticalConflicts: report.hasCritical,
  });
  const blockingProblems = [...assessment.blockingProblems];
  if (days.length === 0) blockingProblems.unshift('These dates include no working days.');
  if (!input.leaveType.isActive) blockingProblems.push('This leave type is no longer offered.');
  const conflicting = new Set(report.taskConflicts.map((conflict) => conflict.taskId));
  return {
    days,
    halfDayUnits,
    durationLabel: formatLeaveDuration(halfDayUnits),
    conflicts: report.taskConflicts,
    overlappingAbsences: report.overlappingAbsences,
    warnings: assessment.warnings,
    blockingProblems,
    approvalLevels: assessment.approvalLevels,
    hasCritical: report.hasCritical,
    affectedWork: tasks.filter((task) => conflicting.has(task.taskId)),
  };
}

/** The snapshot stored with a request, so later changes to the plan stay explainable. */
export function conflictSnapshotOf(impact: LeaveImpact, capturedAt: Date) {
  return {
    capturedAt: capturedAt.toISOString(),
    hasCritical: impact.hasCritical,
    taskConflicts: impact.conflicts.map((conflict) => ({
      taskId: conflict.taskId,
      title: conflict.title,
      severity: conflict.severity,
      explanation: conflict.explanation,
    })),
  };
}
