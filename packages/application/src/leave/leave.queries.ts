import type { Clock } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { UnitOfWork } from '../common/unit-of-work';
import type { LeaveRequestRecord } from './leave.store';
import { canCancelLeaveRequest, canDecideLeaveRequest } from './leave-access';
import { buildLeaveBalances, calendarYearOf, type LeaveBalanceRow } from './leave-balance';
import {
  businessToday,
  calendarOf,
  hasCapability,
  type LeaveStores,
  requireCapability,
  requirePerson,
} from './leave-context';
import { assessLeaveImpact, type LeaveImpact } from './leave-impact.assessor';
import { periodOf } from './leave-input';
import { loadVisibleLeaveRequest } from './leave-request.loader';

export type LeaveListScope = 'mine' | 'to_decide' | 'team' | 'all';

/** Which requests a list shows, resolved from the scope and the viewer's rights. */
export type LeaveListFilter =
  | { readonly kind: 'requester'; readonly userId: string }
  | { readonly kind: 'approver'; readonly userId: string }
  | { readonly kind: 'any_pending'; readonly excludeUserId: string }
  | { readonly kind: 'team'; readonly managerUserId: string; readonly teamId: string | null }
  | { readonly kind: 'all' };

export interface LeaveRequestAccess {
  readonly request: LeaveRequestRecord;
  readonly impact: LeaveImpact;
  readonly viewerCanDecide: boolean;
  readonly viewerCanCancel: boolean;
}

/** Read-side rules for leave: who sees what, live impact and balances. */
export class LeaveQueries {
  constructor(
    private readonly uow: UnitOfWork<LeaveStores>,
    private readonly clock: Clock,
  ) {}

  async detail(context: RequestContext, requestId: string): Promise<LeaveRequestAccess> {
    const stores = this.uow.stores;
    const { request, requester, leaveType } = await loadVisibleLeaveRequest(
      stores,
      context,
      requestId,
    );
    const today = await businessToday(stores.settings, this.clock);
    const impact = await assessLeaveImpact(stores, {
      subject: requester,
      leaveType,
      period: periodOf(request),
      reason: request.reason,
      isUrgentAbsence: request.isUrgentAbsence,
      excludeRequestId: request.id,
      today,
    });
    return {
      request,
      impact,
      viewerCanDecide: canDecideLeaveRequest(context.actor, request),
      viewerCanCancel: canCancelLeaveRequest(context.actor, request, today),
    };
  }

  /**
   * mine → my requests; to_decide → steps waiting for me (every pending
   * request with `leave.approve_any`); team → my reports, plus my team with
   * `capacity.view_team`; all → requires `leave.approve_any`.
   */
  async listFilter(context: RequestContext, scope: LeaveListScope): Promise<LeaveListFilter> {
    const userId = context.actor.userId;
    switch (scope) {
      case 'mine':
        return { kind: 'requester', userId };
      case 'to_decide':
        return hasCapability(context, 'leave.approve_any')
          ? { kind: 'any_pending', excludeUserId: userId }
          : { kind: 'approver', userId };
      case 'team': {
        const viewer = await requirePerson(this.uow.stores, userId);
        const teamId = hasCapability(context, 'capacity.view_team') ? viewer.teamId : null;
        return { kind: 'team', managerUserId: userId, teamId };
      }
      case 'all':
        requireCapability(context, 'leave.approve_any');
        return { kind: 'all' };
    }
  }

  /** Allowance, approved (used) and pending half-days per leave type for this calendar year. */
  async balances(context: RequestContext): Promise<LeaveBalanceRow[]> {
    const stores = this.uow.stores;
    const userId = context.actor.userId;
    const today = await businessToday(stores.settings, this.clock);
    const year = calendarYearOf(today);
    const [types, requests, calendar] = await Promise.all([
      stores.leave.activeLeaveTypes(),
      stores.leave.personRequests(userId, year, ['approved', 'pending', 'info_requested']),
      calendarOf(stores.settings, userId),
    ]);
    return buildLeaveBalances(types, requests, year, calendar);
  }
}
