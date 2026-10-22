import { domainEvent, MAX_REWARD_AMOUNT_MINOR } from '@lintel/domain';
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
import type { RewardDecisionInput } from './decide-reward-evaluation.command';
import { poolOverrunAudit } from './milestone-reward-pool';
import { sendRewardNotice } from './reward-notices';

type DecisionStores = Pick<ApplicationStores, 'milestoneRewards' | 'records' | 'notifications'>;

/** The amount an approval grants; null when the reward is declined. */
function grantedBy(
  input: RewardDecisionInput,
  share: { readonly shareAmountMinor: number },
): number | null {
  if (input.decision !== 'approve') return null;
  return input.adjustedAmountMinor ?? share.shareAmountMinor;
}

/**
 * A person holding `rewards.decide` approves (optionally with a different
 * amount, explained by the note) or declines one person's milestone reward
 * after the rules recommended it or not. Nobody decides their own reward.
 * Approval records the decision only: rewards are paid outside Lintel.
 */
export class DecideMilestoneRewardCommand {
  constructor(
    private readonly uow: UnitOfWork<DecisionStores>,
    private readonly clock: Clock,
    private readonly notifierFor: NotifierFactory,
  ) {}

  async execute(
    context: RequestContext,
    shareId: string,
    input: RewardDecisionInput,
  ): Promise<void> {
    if (!context.actor.capabilities.has('rewards.decide')) throw new ForbiddenError();
    if (input.decision === 'reject' && input.adjustedAmountMinor !== null) {
      throw new ValidationFailedError('An adjusted amount only applies to an approval.', [
        { field: 'adjustedAmountMinor', message: 'Leave this empty when declining.' },
      ]);
    }
    if (input.adjustedAmountMinor !== null && input.adjustedAmountMinor > MAX_REWARD_AMOUNT_MINOR) {
      throw new ValidationFailedError('That amount is too large.', [
        { field: 'adjustedAmountMinor', message: 'Enter a smaller amount.' },
      ]);
    }
    await this.uow.transaction(async (stores) => {
      const share = await stores.milestoneRewards.findShare(shareId);
      if (!share) throw new NotFoundError('Milestone reward');
      if (share.userId === context.actor.userId) {
        throw new ForbiddenError('Someone else decides your own reward.');
      }
      if (share.status !== 'pending_review') {
        throw new InvalidTransitionError('Only rewards waiting for review can be decided.');
      }
      if (share.version !== input.version) throw new StaleVersionError('This milestone reward');
      const status = input.decision === 'approve' ? 'approved' : 'rejected';
      const decided = await stores.milestoneRewards.decideShare(
        share.id,
        share.version,
        'pending_review',
        {
          status,
          decidedByUserId: context.actor.userId,
          decidedAt: this.clock.now(),
          decisionNote: input.note,
          adjustedAmountMinor: input.adjustedAmountMinor,
          adjustmentReason: input.adjustedAmountMinor === null ? null : input.note,
        },
      );
      if (!decided) throw new StaleVersionError('This milestone reward');
      const overrun = await poolOverrunAudit(stores, share, grantedBy(input, share));
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: `rewards.milestone_reward_${status}`,
        entityType: 'milestone_reward_share',
        entityId: share.id,
        before: { status: share.status, shareAmountMinor: share.shareAmountMinor },
        after: {
          status,
          adjustedAmountMinor: input.adjustedAmountMinor,
          note: input.note,
          ...overrun,
        },
        requestId: context.requestId,
      });
      await stores.records.enqueueEvent(
        domainEvent('MilestoneRewardDecided', 'milestone_reward_share', share.id, {
          shareId: share.id,
          userId: share.userId,
          status,
        }),
      );
      await sendRewardNotice(await this.notifierFor(stores), 'reward_updated', [share.userId], {
        title: `"${share.milestoneName}": ${status === 'approved' ? 'reward approved' : 'reward not approved'}`,
        body: 'See the reasons in Rewards. You can challenge the outcome if a record is wrong.',
        linkPath: '/rewards',
        subjectType: 'milestone_reward',
        subjectId: share.id,
        window: status,
      });
    });
  }
}
