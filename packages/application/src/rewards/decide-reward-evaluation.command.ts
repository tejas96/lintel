import { domainEvent, notificationDedupeKey } from '@lintel/domain';
import {
  type Clock,
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  StaleVersionError,
  ValidationFailedError,
} from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { NotifierFactory } from '../notifications/notifier-factory';
import type { RewardEvaluationRecord } from './reward.store';

export interface RewardDecisionInput {
  readonly decision: 'approve' | 'reject';
  readonly note: string;
  /** Only for approvals; the note becomes the adjustment reason. */
  readonly adjustedAmountMinor: number | null;
  readonly version: number;
}

type DecisionStores = Pick<ApplicationStores, 'rewards' | 'records' | 'notifications'>;

/**
 * A person holding `rewards.decide` approves or rejects an eligible
 * evaluation. Audited; the person (or every member of the team) is told,
 * with details hidden from lock-screen previews by the Notifier.
 */
export class DecideRewardEvaluationCommand {
  constructor(
    private readonly uow: UnitOfWork<DecisionStores>,
    private readonly clock: Clock,
    private readonly notifierFor: NotifierFactory,
  ) {}

  async execute(
    context: RequestContext,
    evaluationId: string,
    input: RewardDecisionInput,
  ): Promise<void> {
    if (!context.actor.capabilities.has('rewards.decide')) throw new ForbiddenError();
    if (input.decision === 'reject' && input.adjustedAmountMinor !== null) {
      throw new ValidationFailedError('An adjusted amount only applies to an approval.', [
        { field: 'adjustedAmountMinor', message: 'Leave this empty when rejecting.' },
      ]);
    }
    const now = this.clock.now();
    await this.uow.transaction(async (stores) => {
      const evaluation = await stores.rewards.findEvaluation(evaluationId);
      if (!evaluation) throw new NotFoundError('Reward evaluation');
      if (evaluation.status !== 'pending_review') {
        throw new InvalidTransitionError('Only evaluations waiting for review can be decided.');
      }
      if (evaluation.version !== input.version) throw new StaleVersionError('This evaluation');
      const status = input.decision === 'approve' ? 'approved' : 'rejected';
      const decided = await stores.rewards.decideEvaluation(evaluation.id, evaluation.version, {
        status,
        decidedByUserId: context.actor.userId,
        decidedAt: now,
        decisionNote: input.note,
        adjustedAmountMinor: input.adjustedAmountMinor,
        adjustmentReason: input.adjustedAmountMinor === null ? null : input.note,
      });
      if (!decided) throw new StaleVersionError('This evaluation');
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: `rewards.evaluation_${status}`,
        entityType: 'reward_evaluation',
        entityId: evaluation.id,
        before: { status: evaluation.status, amountMinor: evaluation.amountMinor },
        after: { status, adjustedAmountMinor: input.adjustedAmountMinor, note: input.note },
        requestId: context.requestId,
      });
      await stores.records.enqueueEvent(
        domainEvent('RewardEvaluated', 'reward_evaluation', evaluation.id, {
          evaluationId: evaluation.id,
          userId: evaluation.userId,
          status,
        }),
      );
      await this.notifySubjects(stores, evaluation, status);
    });
  }

  /** The person, or every active member of the team, hears the outcome. */
  private async notifySubjects(
    stores: DecisionStores,
    evaluation: RewardEvaluationRecord,
    status: 'approved' | 'rejected',
  ): Promise<void> {
    const recipients = evaluation.userId
      ? [evaluation.userId]
      : evaluation.teamId
        ? await stores.rewards.teamMemberIds(evaluation.teamId)
        : [];
    const notifier = await this.notifierFor(stores);
    for (const recipientUserId of recipients) {
      await notifier.notify({
        recipientUserId,
        kind: 'reward_updated',
        title: `${evaluation.policyName}: ${status === 'approved' ? 'approved' : 'not approved'}`,
        body: `The review for the period starting ${evaluation.periodStart} is complete.`,
        linkPath: '/rewards',
        subjectType: 'reward_evaluation',
        subjectId: evaluation.id,
        dedupeKey: notificationDedupeKey({
          kind: 'reward_updated',
          recipientId: recipientUserId,
          subjectId: evaluation.id,
          window: status,
        }),
      });
    }
  }
}
