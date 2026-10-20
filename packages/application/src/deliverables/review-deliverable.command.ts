import { checkDeliverableReview, domainEvent, type ReviewDecision } from '@lintel/domain';
import {
  type ApplicationError,
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
  StaleVersionError,
  ValidationFailedError,
} from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { OperationsDependencies } from '../tasks/operations-context';
import { notifyAboutDeliverable, recordDeliverableChange } from './deliverable.commands';
import type { DeliverableRecord } from './deliverable.store';
import { loadDeliverableForActor } from './deliverable-access';

export interface ReviewDeliverableInput {
  readonly decision: ReviewDecision;
  readonly comment: string | null;
  readonly version: number;
}

const DECISION_TEXT: Readonly<Record<ReviewDecision, string>> = {
  approved: 'approved',
  changes_requested: 'needs changes',
  rejected: 'was rejected',
};

/**
 * Decides on the latest submitted version. Nobody reviews their own work;
 * approving a deliverable never completes its task (and vice versa).
 */
export class ReviewDeliverableCommand {
  constructor(private readonly deps: OperationsDependencies) {}

  async execute(
    context: RequestContext,
    versionId: string,
    input: ReviewDeliverableInput,
  ): Promise<DeliverableRecord> {
    const now = this.deps.clock.now();
    const actor = context.actor;
    const entity = 'Deliverable version';
    return this.deps.uow.transaction(async (stores) => {
      const version = await stores.deliverables.findVersion(versionId);
      if (!version) throw new NotFoundError(entity);
      const { deliverable, access } = await loadDeliverableForActor(
        stores,
        actor,
        version.deliverableId,
        true,
        entity,
      );
      if (deliverable.version !== input.version) throw new StaleVersionError('This deliverable');
      const request = {
        deliverableStatus: deliverable.status,
        versionSubmittedBy: version.submittedByUserId,
        reviewerId: actor.userId,
        isAssignedReviewer: deliverable.reviewerUserId === actor.userId,
        canReviewAny: access.canManage,
        decision: input.decision,
        comment: input.comment,
      };
      const check = checkDeliverableReview(request);
      if (!check.allowed) throw reviewRefusal(request, check.reason);
      if (
        version.versionNumber !== deliverable.currentVersionNumber ||
        version.decision !== 'pending'
      ) {
        throw new PreconditionFailedError('Only the latest submitted version can be reviewed.');
      }
      await stores.deliverables.decideVersion(versionId, {
        decision: input.decision,
        byUserId: actor.userId,
        at: now,
        comment: input.comment,
      });
      const after = await stores.deliverables.updateDeliverable(deliverable.id, input.version, {
        status: check.nextStatus,
        approvedAt: input.decision === 'approved' ? now : null,
      });
      if (!after) throw new StaleVersionError('This deliverable');
      await recordDeliverableChange(stores, context, after, {
        action: 'deliverable.reviewed',
        summary: `Version ${version.versionNumber} of “${after.name}” ${DECISION_TEXT[input.decision]}.`,
        after: { versionId, decision: input.decision, comment: input.comment },
      });
      await stores.records.enqueueEvent(
        domainEvent('DeliverableReviewed', 'deliverable', after.id, {
          deliverableId: after.id,
          versionId,
          decision: input.decision,
        }),
      );
      const notifier = await this.deps.context.notifierFor(stores);
      await notifyAboutDeliverable(
        notifier,
        actor.userId,
        after,
        {
          kind: 'review_decided',
          recipientUserId: version.submittedByUserId,
          title: `“${after.name}” ${DECISION_TEXT[input.decision]}`,
          body: input.comment ?? `Version ${version.versionNumber} was approved.`,
        },
        `decided:${versionId}`,
      );
      return after;
    });
  }
}

/** Not in review → 422, not the reviewer or own work → 403, missing explanation → 400. */
function reviewRefusal(
  request: Parameters<typeof checkDeliverableReview>[0],
  reason: string,
): ApplicationError {
  if (request.deliverableStatus !== 'in_review') return new PreconditionFailedError(reason);
  const isOwnWork = request.versionSubmittedBy === request.reviewerId;
  if (isOwnWork || (!request.isAssignedReviewer && !request.canReviewAny)) {
    return new ForbiddenError(reason);
  }
  return new ValidationFailedError(reason, [{ field: 'comment', message: reason }]);
}
