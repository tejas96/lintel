import { splitMilestoneReward } from '@lintel/domain';
import { InvalidTransitionError, StaleVersionError, ValidationFailedError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { UnitOfWork } from '../common/unit-of-work';
import type { NotifierFactory } from '../notifications/notifier-factory';
import {
  auditablePlan,
  distinctRecipients,
  type MilestoneRewardRequest,
  type PlanStores,
  requirePlanner,
  visibleRewardTarget,
} from './milestone-reward-planning';
import { sendRewardNotice } from './reward-notices';

/**
 * Owners and administrators (`rewards.manage_policies`) attach a reward to an
 * open milestone, or change it until the milestone completes. Shared rewards
 * are split equally by name order (`splitMilestoneReward`). Audited and
 * recipients are told; nothing goes to the project activity feed, which
 * every member can read.
 */
export class PlanMilestoneRewardCommand {
  constructor(
    private readonly uow: UnitOfWork<PlanStores>,
    private readonly notifierFor: NotifierFactory,
  ) {}

  async execute(
    context: RequestContext,
    milestoneId: string,
    request: MilestoneRewardRequest,
  ): Promise<void> {
    requirePlanner(context);
    const people = distinctRecipients(request);
    await this.uow.transaction(async (stores) => {
      const target = await visibleRewardTarget(stores, context, milestoneId);
      if (target.status !== 'pending') {
        throw new InvalidTransitionError(
          `Rewards can only be attached to open milestones; this one is ${target.status}.`,
        );
      }
      const existing = await stores.milestoneRewards.findPlanByMilestone(milestoneId);
      if (existing && existing.version !== request.version) {
        throw new StaleVersionError('This milestone reward');
      }
      if (existing && existing.withdrawnAt === null && existing.evaluatedAt !== null) {
        throw new InvalidTransitionError('This reward was checked when the milestone completed.');
      }
      const ordered = await stores.milestoneRewards.eligibleRecipients(target.projectId, people);
      if (ordered.length !== people.length) {
        throw new ValidationFailedError('Rewards go to active people working on this project.', [
          { field: 'recipientUserIds', message: 'Choose people on this project.' },
        ]);
      }
      const { currency } = await stores.settings.organization();
      const plan = {
        ...request,
        milestoneId,
        projectId: target.projectId,
        currency,
        agreedDueDate: target.dueDate,
        actorUserId: context.actor.userId,
      };
      const planId = existing ? existing.id : (await stores.milestoneRewards.createPlan(plan)).id;
      if (existing && !(await stores.milestoneRewards.updatePlan(planId, existing.version, plan))) {
        throw new StaleVersionError('This milestone reward');
      }
      const shares = splitMilestoneReward(request.amountMinor, ordered.length);
      await stores.milestoneRewards.replaceShares(
        planId,
        ordered.map((userId, position) => ({
          userId,
          position,
          shareAmountMinor: shares[position] ?? 0,
        })),
      );
      const changing = existing !== null && existing.withdrawnAt === null;
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: changing ? 'rewards.milestone_reward_changed' : 'rewards.milestone_reward_attached',
        entityType: 'milestone_reward',
        entityId: planId,
        before: existing
          ? auditablePlan(
              existing,
              existing.recipients.map((share) => share.userId),
              existing.requiredDocumentFolders,
            )
          : null,
        after: auditablePlan(request, ordered, request.requiredDocumentFolders),
        requestId: context.requestId,
      });
      await sendRewardNotice(await this.notifierFor(stores), 'reward_updated', ordered, {
        title: changing
          ? `The reward on "${target.milestoneName}" changed`
          : `A reward is attached to "${target.milestoneName}"`,
        body: 'See what earns it and how it is worked out in Rewards.',
        linkPath: '/rewards',
        subjectType: 'milestone_reward',
        subjectId: planId,
        window: `plan-${(existing?.version ?? 0) + 1}`,
      });
    });
  }
}
