import { NotFoundError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { PersonRecord } from '../people/people.store';
import type { LeaveRequestRecord, LeaveTypeRecord } from './leave.store';
import { canViewLeaveRequest, type LeaveViewer } from './leave-access';
import { type LeaveStores, requirePerson } from './leave-context';
import { requireLeaveType } from './leave-input';

export interface VisibleLeaveRequest {
  readonly request: LeaveRequestRecord;
  readonly requester: PersonRecord;
  readonly leaveType: LeaveTypeRecord;
  readonly viewer: LeaveViewer;
}

/** Loads a leave request the actor may see. Missing and hidden both answer "not found". */
export async function loadVisibleLeaveRequest(
  stores: Pick<LeaveStores, 'leave' | 'people'>,
  context: RequestContext,
  requestId: string,
): Promise<VisibleLeaveRequest> {
  const request = await stores.leave.findRequest(requestId);
  if (!request) throw new NotFoundError('Leave request');
  const requester = await requirePerson(stores, request.userId);
  const viewerPerson = await stores.people.findById(context.actor.userId);
  const viewer: LeaveViewer = { actor: context.actor, teamId: viewerPerson?.teamId ?? null };
  if (!canViewLeaveRequest(viewer, requester, request)) throw new NotFoundError('Leave request');
  return {
    request,
    requester,
    leaveType: await requireLeaveType(stores, request.leaveTypeId),
    viewer,
  };
}
