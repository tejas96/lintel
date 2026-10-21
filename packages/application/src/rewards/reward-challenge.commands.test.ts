import { describe, expect, it } from 'vitest';
import { rewardWorld } from '../testing/reward-test-world';
import { RaiseRewardChallengeCommand } from './raise-reward-challenge.command';
import { ResolveRewardChallengeCommand } from './resolve-reward-challenge.command';

const evidence = { criteria: [], metrics: {}, policyVersion: 1 };

/** ana was not eligible in October; dev was approved ₹3,000 by the owner. */
function setup() {
  const world = rewardWorld();
  world.rewards.policies.push({
    id: 'policy',
    name: 'Monthly on-time delivery',
    description: null,
    scope: 'individual',
    period: 'monthly',
    criteria: [],
    amountMinor: 300_000,
    currency: 'INR',
    isActive: true,
    version: 1,
  });
  const evaluation = (id: string, userId: string, status: 'ineligible' | 'pending_review') => ({
    id,
    policyId: 'policy',
    subjectKey: `user:${userId}`,
    userId,
    teamId: null,
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    status,
    summary: 'Not eligible yet',
    evidence,
    amountMinor: 300_000,
    version: 1,
    decision: null,
  });
  world.rewards.evaluations.push(evaluation('ana-oct', 'ana', 'ineligible'));
  world.rewards.evaluations.push({
    ...evaluation('dev-oct', 'dev', 'pending_review'),
    decision: {
      status: 'approved',
      decidedByUserId: 'owner',
      decidedAt: new Date(),
      decisionNote: 'Well done',
      adjustedAmountMinor: null,
      adjustmentReason: null,
    },
  });
  const raise = new RaiseRewardChallengeCommand(world.uow, world.notifierFor);
  const resolve = new ResolveRewardChallengeCommand(world.uow, world.clock, world.notifierFor);
  return { ...world, raise, resolve };
}

const anaRecord = { kind: 'evaluation' as const, recordId: 'ana-oct' };
const devRecord = { kind: 'evaluation' as const, recordId: 'dev-oct' };

describe('raising a challenge', () => {
  it('records the reason with the outcome at that moment and tells the reviewer', async () => {
    const { raise, ctx, rewardChallenges, notifications, records } = setup();
    const reason = 'Two of my tasks waited on the client; the blocker was recorded on 12 Oct.';
    const { challengeId } = await raise.execute(ctx('ana'), anaRecord, reason);
    expect(await rewardChallenges.find(challengeId)).toMatchObject({
      status: 'open',
      reason,
      recordBefore: { status: 'ineligible', grantedAmountMinor: null },
    });
    expect(notifications.to('owner')).toEqual(['reward_review_requested']);
    expect(records.audits.at(-1)?.action).toBe('rewards.challenge_raised');
    expect(records.events).toEqual(['RewardChallengeRaised']);
  });

  it('is only for the person the record is about, one at a time', async () => {
    const { raise, ctx } = setup();
    await expect(raise.execute(ctx('dev'), anaRecord, 'Not mine')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(raise.execute(ctx('owner'), anaRecord, 'Not mine')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await raise.execute(ctx('ana'), anaRecord, 'Please look again');
    await expect(raise.execute(ctx('ana'), anaRecord, 'Again')).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
  });
});

describe('answering a challenge', () => {
  it('upholds with a note and tells the person who raised it', async () => {
    const { raise, resolve, ctx, rewardChallenges, notifications, rewards } = setup();
    const { challengeId } = await raise.execute(ctx('ana'), anaRecord, 'Please look again');
    await resolve.execute(ctx('owner'), challengeId, {
      outcome: 'uphold',
      note: 'The client blocker was raised after the due date.',
      correctedAmountMinor: null,
      version: 1,
    });
    expect(await rewardChallenges.find(challengeId)).toMatchObject({ status: 'upheld' });
    expect(notifications.to('ana')).toEqual(['reward_updated']);
    expect((await rewards.findEvaluation('ana-oct'))?.status).toBe('ineligible');
  });

  it('corrects by granting a reward that was not granted', async () => {
    const { raise, resolve, ctx, rewards, records } = setup();
    const { challengeId } = await raise.execute(
      ctx('ana'),
      anaRecord,
      'The blocker was the client',
    );
    await resolve.execute(ctx('owner'), challengeId, {
      outcome: 'correct',
      note: 'Agreed: the delay was the client’s.',
      correctedAmountMinor: 300_000,
      version: 1,
    });
    expect(await rewards.findEvaluation('ana-oct')).toMatchObject({
      status: 'approved',
      adjustedAmountMinor: 300_000,
      decidedByUserId: 'owner',
    });
    expect(records.audits.at(-1)).toMatchObject({
      action: 'rewards.challenge_corrected',
      before: { record: { status: 'ineligible', grantedAmountMinor: null } },
      after: { record: { status: 'approved', grantedAmountMinor: 300_000 } },
    });
  });

  it('never lowers a granted reward, and is never answered by the person themself', async () => {
    const { raise, resolve, ctx } = setup();
    const { challengeId } = await raise.execute(ctx('dev'), devRecord, 'The amount missed a task');
    const correct = { outcome: 'correct' as const, note: 'Lower', version: 1 };
    await expect(
      resolve.execute(ctx('owner'), challengeId, { ...correct, correctedAmountMinor: 200_000 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      resolve.execute(ctx('owner'), challengeId, {
        ...correct,
        outcome: 'uphold',
        correctedAmountMinor: 400_000,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      resolve.execute(ctx('admin'), challengeId, { ...correct, correctedAmountMinor: 400_000 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      resolve.execute(ctx('owner'), challengeId, {
        ...correct,
        correctedAmountMinor: 400_000,
        version: 7,
      }),
    ).rejects.toMatchObject({ code: 'STALE_VERSION' });
    await resolve.execute(ctx('owner'), challengeId, {
      ...correct,
      note: 'Raised for the missing task',
      correctedAmountMinor: 400_000,
    });
    await expect(
      resolve.execute(ctx('owner'), challengeId, {
        ...correct,
        correctedAmountMinor: 500_000,
        version: 2,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('refuses a reviewer who is the subject of the record', async () => {
    const { raise, resolve, ctx, rewardChallenges } = setup();
    rewardChallenges.reviewers = ['owner', 'ana'];
    const { challengeId } = await raise.execute(ctx('ana'), anaRecord, 'Please look again');
    const ana = ctx('ana');
    const reviewerAna = {
      ...ana,
      actor: {
        ...ana.actor,
        capabilities: new Set([...ana.actor.capabilities, 'rewards.decide' as const]),
      },
    };
    await expect(
      resolve.execute(reviewerAna, challengeId, {
        outcome: 'uphold',
        note: 'Fine',
        correctedAmountMinor: null,
        version: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
