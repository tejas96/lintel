import { fixedClock } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import type { UnitOfWork } from '../common/unit-of-work';
import { Notifier } from '../notifications/notifier';
import { InMemoryRewardStore } from '../testing/in-memory-reward.store';
import {
  CollectedNotifications,
  fakeSettings,
  leaveWorld,
  RecordedEffects,
  TEST_NOW,
} from '../testing/leave-test-world';
import { DecideRewardEvaluationCommand } from './decide-reward-evaluation.command';
import { type RewardStores, RunRewardEvaluationCommand } from './run-reward-evaluation.command';

const at = (value: string) => new Date(`${value}+05:30`);
const clock = fixedClock(TEST_NOW);

function setup() {
  const { ctx } = leaveWorld();
  const rewards = new InMemoryRewardStore();
  rewards.people = [
    { userId: 'ana', teamId: 'design' },
    { userId: 'dev', teamId: 'design' },
  ];
  rewards.policies.push({
    id: 'policy',
    name: 'Monthly on-time delivery',
    description: null,
    scope: 'individual',
    period: 'monthly',
    criteria: [
      { type: 'on_time_delivery_rate', minimumRate: 0.75, minimumTasks: 2 },
      { type: 'on_time_improvement', minimumPercentagePoints: 10 },
    ],
    amountMinor: 500_000,
    currency: 'INR',
    isActive: true,
    version: 3,
  });
  const done = (taskId: string, owner: string, completed: string, due: string) => ({
    taskId,
    ownerUserId: owner,
    collaboratorUserIds: [],
    completedAt: at(completed),
    dueDate: due,
    requiresReview: false,
    reviewRounds: 0,
    requiredChecklistCompletedAt: [],
    blockers: [],
  });
  rewards.tasks.push(
    done('a1', 'ana', '2026-10-05T12:00:00', '2026-10-06'),
    done('a2', 'ana', '2026-10-12T12:00:00', '2026-10-12'),
    done('a-sept', 'ana', '2026-09-10T12:00:00', '2026-09-08'),
    done('d1', 'dev', '2026-10-16T12:00:00', '2026-10-13'),
  );
  const records = new RecordedEffects();
  const notifications = new CollectedNotifications();
  const stores = { rewards, settings: fakeSettings(), records, notifications };
  const uow: UnitOfWork<RewardStores & { notifications: CollectedNotifications }> = {
    stores,
    transaction: (work) => work(stores),
  };
  const run = new RunRewardEvaluationCommand(uow, clock);
  const decide = new DecideRewardEvaluationCommand(
    uow,
    clock,
    async (bound) =>
      new Notifier(bound.notifications, bound.records, clock, {
        timeZone: 'Asia/Kolkata',
        quietHoursStart: '21:00',
        quietHoursEnd: '08:00',
        smsConfigured: false,
      }),
  );
  return { rewards, records, notifications, run, decide, ctx };
}

describe('reward evaluation runs', () => {
  it('evaluates every person from their records, with evidence', async () => {
    const { rewards, run, ctx } = setup();
    await expect(run.execute(ctx('owner'), 'policy', '2026-10-15')).resolves.toEqual({
      evaluated: 2,
      eligible: 1,
    });
    const ana = rewards.evaluations.find((row) => row.userId === 'ana');
    expect(ana).toMatchObject({
      subjectKey: 'user:ana',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      status: 'pending_review',
      amountMinor: 500_000,
    });
    expect(ana?.evidence.policyVersion).toBe(3);
    expect(ana?.evidence.metrics).toMatchObject({ ownedTasksCompleted: 2, previousOnTimeRate: 0 });
    expect(rewards.evaluations.find((row) => row.userId === 'dev')?.status).toBe('ineligible');
  });

  it('is idempotent: re-running refreshes, never duplicates, and leaves decisions alone', async () => {
    const { rewards, run, decide, ctx, notifications, records } = setup();
    await run.execute(ctx('owner'), 'policy', '2026-10-01');
    await run.execute(ctx('owner'), 'policy', '2026-10-31');
    expect(rewards.evaluations).toHaveLength(2);
    const ana = rewards.evaluations.find((row) => row.userId === 'ana');
    if (!ana) throw new Error('missing');
    expect(ana.version).toBe(2);
    await decide.execute(ctx('owner'), ana.id, {
      decision: 'approve',
      note: 'Well done',
      adjustedAmountMinor: 550_000,
      version: 2,
    });
    expect(ana.decision).toMatchObject({ status: 'approved', adjustmentReason: 'Well done' });
    await expect(run.execute(ctx('owner'), 'policy', '2026-10-01')).resolves.toEqual({
      evaluated: 1,
      eligible: 0,
    });
    expect(rewards.evaluations).toHaveLength(2);
    expect(ana.version).toBe(3);
    expect(notifications.to('ana')).toEqual(['reward_updated']);
    expect(records.events).toEqual(['RewardEvaluated']);
  });

  it('checks permissions, the period and stale versions', async () => {
    const { rewards, run, decide, ctx } = setup();
    await expect(run.execute(ctx('dev'), 'policy', '2026-10-01')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(run.execute(ctx('owner'), 'policy', '2026-11-01')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    await run.execute(ctx('admin'), 'policy', '2026-10-01');
    const ana = rewards.evaluations.find((row) => row.userId === 'ana');
    const dev = rewards.evaluations.find((row) => row.userId === 'dev');
    if (!ana || !dev) throw new Error('missing');
    const approve = { decision: 'approve' as const, note: 'ok', adjustedAmountMinor: null };
    await expect(
      decide.execute(ctx('admin'), ana.id, { ...approve, version: 1 }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      decide.execute(ctx('owner'), ana.id, { ...approve, version: 9 }),
    ).rejects.toMatchObject({
      code: 'STALE_VERSION',
    });
    await expect(
      decide.execute(ctx('owner'), dev.id, { ...approve, version: 1 }),
    ).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    });
  });
});
