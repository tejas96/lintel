import { type Actor, isLegalLeaveTransition } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import type { ApplicationStores } from '../common/unit-of-work';
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

export interface LeaveReasonFacts {
  readonly requesterUserId: string;
  readonly requesterManagerUserId: string | null;
  readonly recordedByUserId: string | null;
  readonly approverUserIds: readonly (string | null)[];
}

/**
 * The reason (and the conversation about it: questions, decision notes) is
 * personal. Only the person, their manager, the approvers of the request, the
 * manager who recorded an urgent absence, and people deciding any leave
 * (owner, administrators) read it. Colleagues covering work, team leads and
 * project managers see the dates, the type and the work impact only.
 */
export function canSeeLeaveReason(
  viewer: Pick<Actor, 'userId' | 'capabilities'>,
  facts: LeaveReasonFacts,
): boolean {
  const userId = viewer.userId;
  if (viewer.capabilities.has('leave.approve_any')) return true;
  if (facts.requesterUserId === userId || facts.requesterManagerUserId === userId) return true;
  if (facts.recordedByUserId === userId) return true;
  return facts.approverUserIds.includes(userId);
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

/**
 * Recording an urgent absence approves it immediately, so it is limited to
 * people who could approve that leave anyway: managers for their direct
 * reports, or holders of `leave.approve_any`. Never for oneself — that would
 * bypass the approval chain.
 */
export function canRecordAbsenceFor(
  viewer: LeaveViewer,
  subject: { id: string; teamId: string | null; reportsToUserId: string | null },
  /** True when the viewer is the subject's manager, or their manager's manager, and so on. */
  viewerIsInReportingLine: boolean,
): boolean {
  const capabilities = viewer.actor.capabilities;
  if (!capabilities.has('leave.record_absence')) return false;
  if (subject.id === viewer.actor.userId) return false;
  return capabilities.has('leave.approve_any') || viewerIsInReportingLine;
}

/** Walks the subject's manager chain (bounded, cycle-safe) looking for the viewer. */
export async function isInReportingLine(
  stores: Pick<ApplicationStores, 'people'>,
  subject: { reportsToUserId: string | null },
  viewerId: string,
): Promise<boolean> {
  const seen = new Set<string>();
  let managerId = subject.reportsToUserId;
  while (managerId && !seen.has(managerId) && seen.size < 8) {
    if (managerId === viewerId) return true;
    seen.add(managerId);
    managerId = (await stores.people.findById(managerId))?.reportsToUserId ?? null;
  }
  return false;
}
