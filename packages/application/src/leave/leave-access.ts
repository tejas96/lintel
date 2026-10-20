import { type Actor, isLegalLeaveTransition } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import type { LeaveRequestRecord } from './leave.store';
import { currentStep } from './leave-approval-routing';

export interface LeaveViewer {
  readonly actor: Actor;
  readonly teamId: string | null;
}

export interface LeaveRequester {
  readonly id: string;
  readonly teamId: string | null;
  readonly reportsToUserId: string | null;
}

/**
 * Who may see a leave request: the person, their manager, approvers, people
 * deciding any leave, team leads of the same team, and the people a handover
 * involves. Everyone else gets "not found".
 */
export function canViewLeaveRequest(
  viewer: LeaveViewer,
  requester: LeaveRequester,
  request: LeaveRequestRecord,
): boolean {
  const userId = viewer.actor.userId;
  const capabilities = viewer.actor.capabilities;
  if (requester.id === userId || requester.reportsToUserId === userId) return true;
  if (request.recordedByUserId === userId) return true;
  if (capabilities.has('leave.approve_any')) return true;
  if (request.steps.some((step) => step.approverUserId === userId)) return true;
  if (
    capabilities.has('capacity.view_team') &&
    viewer.teamId !== null &&
    viewer.teamId === requester.teamId
  ) {
    return true;
  }
  return request.handovers.some(
    (handover) => handover.toUserId === userId || handover.projectManagerUserId === userId,
  );
}

/**
 * The approver of the current pending step decides; people holding
 * `leave.approve_any` may decide for them, but never on their own request.
 */
export function canDecideLeaveRequest(actor: Actor, request: LeaveRequestRecord): boolean {
  if (request.status !== 'pending' && request.status !== 'info_requested') return false;
  const step = currentStep(request.steps);
  if (step?.approverUserId === actor.userId) return true;
  return actor.capabilities.has('leave.approve_any') && actor.userId !== request.userId;
}

/** The requester may cancel before the leave starts; leave managers may cancel any time. */
export function canCancelLeaveRequest(
  actor: Actor,
  request: LeaveRequestRecord,
  today: CalendarDate,
): boolean {
  if (!isLegalLeaveTransition(request.status, 'cancelled')) return false;
  if (actor.capabilities.has('leave.approve_any')) return true;
  return actor.userId === request.userId && today < request.startDate;
}

/** Recording an absence: for my reports or my team, or anyone with `leave.approve_any`. */
export function canRecordAbsenceFor(
  viewer: LeaveViewer,
  subject: { id: string; teamId: string | null; reportsToUserId: string | null },
): boolean {
  const capabilities = viewer.actor.capabilities;
  if (!capabilities.has('leave.record_absence')) return false;
  if (capabilities.has('leave.approve_any')) return true;
  if (subject.id === viewer.actor.userId) return true;
  if (subject.reportsToUserId === viewer.actor.userId) return true;
  return viewer.teamId !== null && subject.teamId === viewer.teamId;
}
