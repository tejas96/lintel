import { domainEvent, isLegalLeaveTransition } from '@lintel/domain';
import { ForbiddenError, InvalidTransitionError, StaleVersionError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import { canCancelLeaveRequest } from './leave-access';
import { unfinishedSteps } from './leave-approval-routing';
import { businessToday, type LeaveDependencies } from './leave-context';
import { summaryFacts } from './leave-input';
import { leaveDecidedNotification } from './leave-notifications';
import { loadVisibleLeaveRequest } from './leave-request.loader';

/**
 * The requester may withdraw before the start date; people holding
 * `leave.approve_any` may cancel at any time. Always audited.
 */
export class CancelLeaveRequestCommand {
  constructor(private readonly deps: LeaveDependencies) {}

  async execute(
    context: RequestContext,
    requestId: string,
    input: { note: string | null; version: number },
  ): Promise<void> {
    const now = this.deps.clock.now();
    await this.deps.uow.transaction(async (stores) => {
      const { request, requester, leaveType } = await loadVisibleLeaveRequest(
        stores,
        context,
        requestId,
      );
      if (!isLegalLeaveTransition(request.status, 'cancelled')) {
        throw new InvalidTransitionError(`This request is already ${request.status}.`);
      }
      const today = await businessToday(stores.settings, this.deps.clock);
      if (!canCancelLeaveRequest(context.actor, request, today)) {
        throw new ForbiddenError(
          request.userId === context.actor.userId
            ? 'Leave that has already started can only be cancelled by a leave manager.'
            : 'Only the requester or a leave manager can cancel this request.',
        );
      }
      if (request.version !== input.version) throw new StaleVersionError('This leave request');
      const updated = await stores.leave.updateRequest(request.id, request.version, {
        status: 'cancelled',
        cancelledAt: now,
        decisionNote: input.note,
      });
      if (!updated) throw new StaleVersionError('This leave request');
      for (const step of unfinishedSteps(request.steps)) {
        await stores.leave.updateStep(step.id, { status: 'skipped' });
      }
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'leave.cancelled',
        entityType: 'leave_request',
        entityId: request.id,
        before: { status: request.status },
        after: { status: 'cancelled', note: input.note, startDate: request.startDate },
        requestId: context.requestId,
      });
      await stores.records.enqueueEvent(
        domainEvent('LeaveDecided', 'leave_request', request.id, {
          leaveRequestId: request.id,
          userId: request.userId,
          status: 'cancelled',
        }),
      );
      if (context.actor.userId !== request.userId) {
        const notifier = await this.deps.notifierFor(stores);
        await notifier.notify(
          leaveDecidedNotification(
            request.userId,
            summaryFacts(request.id, requester, leaveType, request),
            'cancelled',
            input.note,
            request.version + 1,
          ),
        );
      }
    });
  }
}
