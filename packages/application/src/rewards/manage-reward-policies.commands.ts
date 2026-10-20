import { ForbiddenError, NotFoundError, StaleVersionError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { UnitOfWork } from '../common/unit-of-work';
import type { RewardPolicyInput, RewardPolicyRecord } from './reward.store';
import type { RewardStores } from './run-reward-evaluation.command';

function requireManage(context: RequestContext): void {
  if (!context.actor.capabilities.has('rewards.manage_policies')) throw new ForbiddenError();
}

function auditable(policy: RewardPolicyInput) {
  return {
    name: policy.name,
    scope: policy.scope,
    period: policy.period,
    criteria: policy.criteria.map((criterion) => criterion.type),
    amountMinor: policy.amountMinor,
    isActive: policy.isActive,
  };
}

/** Reward rules are configured by people holding `rewards.manage_policies`. */
export class ManageRewardPoliciesCommands {
  constructor(private readonly uow: UnitOfWork<RewardStores>) {}

  async create(context: RequestContext, input: RewardPolicyInput): Promise<RewardPolicyRecord> {
    requireManage(context);
    return this.uow.transaction(async (stores) => {
      const { currency } = await stores.settings.organization();
      const policy = await stores.rewards.createPolicy(input, currency, context.actor.userId);
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'rewards.policy_created',
        entityType: 'reward_policy',
        entityId: policy.id,
        after: auditable(policy),
        requestId: context.requestId,
      });
      return policy;
    });
  }

  async update(
    context: RequestContext,
    policyId: string,
    expectedVersion: number,
    input: RewardPolicyInput,
  ): Promise<RewardPolicyRecord> {
    requireManage(context);
    return this.uow.transaction(async (stores) => {
      const before = await stores.rewards.findPolicy(policyId);
      if (!before) throw new NotFoundError('Reward policy');
      const after = await stores.rewards.updatePolicy(policyId, expectedVersion, input);
      if (!after) throw new StaleVersionError('This reward policy');
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'rewards.policy_updated',
        entityType: 'reward_policy',
        entityId: policyId,
        before: auditable(before),
        after: auditable(after),
        requestId: context.requestId,
      });
      return after;
    });
  }
}
