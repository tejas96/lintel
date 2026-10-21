import {
  type Clock,
  InvalidTransitionError,
  NotFoundError,
  StaleVersionError,
} from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { UnitOfWork } from '../common/unit-of-work';
import type { NotifierFactory } from '../notifications/notifier-factory';
import {
  auditablePlan,
  type PlanStores,
  requirePlanner,
  visibleRewardTarget,
} from './milestone-reward-planning';
import { sendRewardNotice } from './reward-notices';

/**
 * A planner removes a milestone reward with a reason, before the milestone
 * completes. Once the rules have checked it, only a reviewer's decision
 * settles it. The row stays (withdrawn) so the history is complete.
 */
export class WithdrawMilestoneRewardCommand {
  constructor(
    private readonly uow: UnitOfWork<PlanStores>,
    private readonly clock: Clock,
    private readonly notifierFor: NotifierFactory,
  ) {}

  async execute(
    context: RequestContext,
    milestoneId: string,
    input: { readonly version: number; readonly reason: string },
  ): Promise<void> {
    requirePlanner(context);
    await this.uow.transaction(async (stores) => {
      const target = await visibleRewardTarget(stores, context, milestoneId);
      const plan = await stores.milestoneRewards.findPlanByMilestone(milestoneId);
      if (!plan || plan.withdrawnAt !== null) throw new NotFoundError('Milestone reward');
      if (plan.version !== input.version) throw new StaleVersionError('This milestone reward');
      if (plan.evaluatedAt !== null) {
        throw new InvalidTransitionError(
          'This reward was checked when the milestone completed; a reviewer decides it now.',
        );
      }
      const withdrawn = await stores.milestoneRewards.withdrawPlan(plan.id, plan.version, {
        at: this.clock.now(),
        byUserId: context.actor.userId,
        reason: input.reason,
      });
      if (!withdrawn) throw new StaleVersionError('This milestone reward');
      const recipients = plan.recipients.map((share) => share.userId);
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'rewards.milestone_reward_withdrawn',
        entityType: 'milestone_reward',
        entityId: plan.id,
        before: auditablePlan(plan, recipients, plan.requiredDocumentFolders),
        after: { withdrawn: true, reason: input.reason },
        requestId: context.requestId,
      });
      await sendRewardNotice(await this.notifierFor(stores), 'reward_updated', recipients, {
        title: `The reward on "${target.milestoneName}" was withdrawn`,
        body: input.reason,
        linkPath: '/rewards',
        subjectType: 'milestone_reward',
        subjectId: plan.id,
        window: `withdrawn-${plan.version}`,
      });
    });
  }
}
