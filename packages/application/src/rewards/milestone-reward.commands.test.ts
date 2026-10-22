import { describe, expect, it } from 'vitest';
import { rewardWorld } from '../testing/reward-test-world';
import { DecideMilestoneRewardCommand } from './decide-milestone-reward.command';
import { evaluateMilestoneReward } from './evaluate-milestone-reward';
import type { MilestoneRewardRequest } from './milestone-reward-planning';
import { PlanMilestoneRewardCommand } from './plan-milestone-reward.command';
import { WithdrawMilestoneRewardCommand } from './withdraw-milestone-reward.command';

const shared: MilestoneRewardRequest = {
  scope: 'team',
  recipientUserIds: ['dev', 'ana'],
  amountMinor: 500_001,
  requiredDocumentFolders: ['drawings'],
  note: 'For a clean concept sign-off',
  version: null,
};

function setup() {
  const world = rewardWorld();
  const plan = new PlanMilestoneRewardCommand(world.uow, world.notifierFor);
  const withdraw = new WithdrawMilestoneRewardCommand(world.uow, world.clock, world.notifierFor);
  const decide = new DecideMilestoneRewardCommand(world.uow, world.clock, world.notifierFor);
  const complete = (completedAt: string) =>
    evaluateMilestoneReward(world.stores, world.notifierFor, {
      milestoneId: 'concept',
      completedAt: new Date(completedAt),
      actorUserId: 'pm',
      requestId: 'r',
    });
  return { ...world, plan, withdraw, decide, complete };
}

describe('attaching a milestone reward', () => {
  it('splits a shared reward equally in name order and tells the recipients', async () => {
    const { plan, ctx, milestoneRewards, notifications, records } = setup();
    await plan.execute(ctx('admin'), 'concept', shared);
    const saved = await milestoneRewards.findPlanByMilestone('concept');
    expect(saved).toMatchObject({
      scope: 'team',
      amountMinor: 500_001,
      agreedDueDate: '2026-11-02',
    });
    expect(saved?.recipients.map((share) => [share.userId, share.shareAmountMinor])).toEqual([
      ['ana', 250_001],
      ['dev', 250_000],
    ]);
    expect(notifications.to('ana')).toEqual(['reward_updated']);
    expect(records.audits.map((entry) => entry.action)).toEqual([
      'rewards.milestone_reward_attached',
    ]);
    expect(records.activity).toEqual([]);
  });

  it('is for planners only, for people on the project, with the right number of people', async () => {
    const { plan, ctx } = setup();
    await expect(plan.execute(ctx('pm'), 'concept', shared)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      plan.execute(ctx('admin'), 'concept', { ...shared, recipientUserIds: ['ana', 'lead'] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      plan.execute(ctx('admin'), 'concept', { ...shared, scope: 'individual' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(plan.execute(ctx('admin'), 'missing', shared)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('changes with the version, and withdraws with a reason before completion', async () => {
    const { plan, withdraw, ctx, milestoneRewards } = setup();
    await plan.execute(ctx('admin'), 'concept', shared);
    await expect(plan.execute(ctx('admin'), 'concept', shared)).rejects.toMatchObject({
      code: 'STALE_VERSION',
    });
    await plan.execute(ctx('owner'), 'concept', {
      ...shared,
      scope: 'individual',
      recipientUserIds: ['ana'],
      version: 1,
    });
    const changed = await milestoneRewards.findPlanByMilestone('concept');
    expect(changed?.recipients.map((share) => share.userId)).toEqual(['ana']);
    await withdraw.execute(ctx('admin'), 'concept', {
      version: 2,
      reason: 'Scope moved to phase two',
    });
    expect((await milestoneRewards.findPlanByMilestone('concept'))?.withdrawnAt).not.toBeNull();
  });
});

describe('checking the reward when the milestone completes', () => {
  it('recommends, asks a reviewer, and grants nothing by itself', async () => {
    const { plan, complete, ctx, milestoneRewards, notifications, records } = setup();
    await plan.execute(ctx('admin'), 'concept', shared);
    milestoneRewards.facts = {
      deliverables: [{ name: 'Concept deck', isRequired: true, submitted: true, approved: true }],
      foldersOnFile: new Set(['drawings']),
      blockers: [
        // Waiting on the client for two working days, resolved before the late finish.
        {
          category: 'client',
          waitingOnUserId: null,
          raisedAt: new Date('2026-10-28T06:00:00Z'),
          resolvedAt: new Date('2026-10-30T06:00:00Z'),
        },
        // ana waited on dev: excuses ana, not dev.
        {
          category: 'internal_dependency',
          waitingOnUserId: 'dev',
          raisedAt: new Date('2026-10-30T06:00:00Z'),
          resolvedAt: new Date('2026-10-31T06:00:00Z'),
        },
      ],
    };
    await complete('2026-11-05T08:00:00Z');
    const shares = milestoneRewards.shares;
    const ana = shares.find((share) => share.userId === 'ana');
    const dev = shares.find((share) => share.userId === 'dev');
    expect(ana).toMatchObject({ status: 'pending_review', decision: null });
    expect(ana?.assessment?.recommendation).toBe('grant');
    expect(dev?.assessment?.recommendation).toBe('withhold');
    expect(dev?.assessment?.summary).toContain('nothing is deducted automatically');
    expect(dev?.shareAmountMinor).toBe(250_000);
    expect(notifications.to('owner')).toEqual(['reward_review_requested']);
    expect(notifications.to('dev')).toEqual(['reward_updated', 'reward_updated']);
    expect(records.events).toContain('MilestoneRewardEvaluated');
    // Completing again (a retry) changes nothing.
    await complete('2026-11-06T08:00:00Z');
    expect(milestoneRewards.shares.find((share) => share.userId === 'ana')?.version).toBe(
      ana?.version,
    );
  });

  it('lets a reviewer decide, never their own, with an amount only on approval', async () => {
    const { plan, complete, decide, ctx, milestoneRewards, notifications, records } = setup();
    await plan.execute(ctx('admin'), 'concept', shared);
    await complete('2026-11-02T08:00:00Z');
    const ana = milestoneRewards.shares.find((share) => share.userId === 'ana');
    if (!ana) throw new Error('missing share');
    const approve = {
      decision: 'approve' as const,
      note: 'Clean sign-off',
      adjustedAmountMinor: null,
    };
    await expect(
      decide.execute(ctx('admin'), ana.id, { ...approve, version: ana.version }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      decide.execute(ctx('owner'), ana.id, {
        ...approve,
        decision: 'reject',
        adjustedAmountMinor: 5,
        version: ana.version,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await decide.execute(ctx('owner'), ana.id, {
      ...approve,
      adjustedAmountMinor: 300_000,
      version: ana.version,
    });
    expect(ana).toMatchObject({ status: 'approved' });
    expect(ana.decision).toMatchObject({
      adjustedAmountMinor: 300_000,
      adjustmentReason: 'Clean sign-off',
    });
    // 300,000 + dev's 250,000 still waiting passes the 500,001 pool: allowed, and recorded.
    expect(records.audits.at(-1)?.after).toMatchObject({
      poolMinor: 500_001,
      poolTotalMinor: 550_000,
      poolOverrunMinor: 49_999,
    });
    expect(notifications.to('ana').at(-1)).toBe('reward_updated');
    await expect(
      decide.execute(ctx('owner'), ana.id, { ...approve, version: ana.version }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('cannot be changed or withdrawn once checked', async () => {
    const { plan, withdraw, complete, ctx, milestoneRewards } = setup();
    await plan.execute(ctx('admin'), 'concept', shared);
    await complete('2026-11-02T08:00:00Z');
    milestoneRewards.targets.set('concept', {
      milestoneId: 'concept',
      projectId: 'project',
      milestoneName: 'Concept approved',
      dueDate: '2026-11-02',
      status: 'completed',
    });
    await expect(
      plan.execute(ctx('admin'), 'concept', { ...shared, version: 1 }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    await expect(
      withdraw.execute(ctx('admin'), 'concept', { version: 1, reason: 'No' }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });
});
