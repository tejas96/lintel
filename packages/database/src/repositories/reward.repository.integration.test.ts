import { randomUUID } from 'node:crypto';
import { type RequestContext, RunRewardEvaluationCommand } from '@lintel/application';
import { DEFAULT_ROLE_CAPABILITIES } from '@lintel/domain';
import { fixedClock } from '@lintel/shared';
import { and, count, eq, ne, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DatabaseConnection } from '../client';
import { rewardEvaluations, rewardPolicies, users } from '../schema';
import { DrizzleUnitOfWork } from '../unit-of-work';
import { RewardRepository } from './reward.repository';

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const evidence = { criteria: [], metrics: { ownedTasksCompleted: 0 }, policyVersion: 1 };

describe.skipIf(!url)('reward evaluation upsert (PostgreSQL)', () => {
  let connection: DatabaseConnection;
  let repository: RewardRepository;
  let ownerId: string;
  const policyIds: string[] = [];

  beforeAll(async () => {
    connection = createDatabaseConnection(url ?? '', { max: 2 });
    repository = new RewardRepository(connection.db);
    const [owner] = await connection.db.select().from(users).where(eq(users.role, 'owner'));
    if (!owner) throw new Error('Seed the database before running integration tests.');
    ownerId = owner.id;
  });

  afterAll(async () => {
    for (const policyId of policyIds) {
      await connection.db.delete(rewardEvaluations).where(eq(rewardEvaluations.policyId, policyId));
      await connection.db.delete(rewardPolicies).where(eq(rewardPolicies.id, policyId));
    }
    await connection.close();
  });

  async function policy(): Promise<string> {
    const created = await repository.createPolicy(
      {
        name: `Integration ${randomUUID()}`,
        description: null,
        scope: 'individual',
        period: 'monthly',
        criteria: [{ type: 'on_time_delivery_rate', minimumRate: 0.8, minimumTasks: 1 }],
        amountMinor: 100_000,
        isActive: true,
      },
      'INR',
      ownerId,
    );
    policyIds.push(created.id);
    return created.id;
  }

  it('creates once, refreshes while undecided and never touches a decided evaluation', async () => {
    const policyId = await policy();
    const input = {
      policyId,
      subjectKey: `user:${ownerId}`,
      userId: ownerId,
      teamId: null,
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      status: 'ineligible' as const,
      summary: 'first',
      evidence,
      amountMinor: 100_000,
    };
    expect(await repository.upsertEvaluation(input)).toBe('created');
    expect(
      await repository.upsertEvaluation({ ...input, status: 'pending_review', summary: 'second' }),
    ).toBe('refreshed');
    const [row] = await connection.db
      .select()
      .from(rewardEvaluations)
      .where(eq(rewardEvaluations.policyId, policyId));
    expect(row).toMatchObject({ status: 'pending_review', summary: 'second', version: 2 });
    if (!row) throw new Error('missing evaluation');
    const decided = await repository.decideEvaluation(row.id, 2, {
      status: 'approved',
      decidedByUserId: ownerId,
      decidedAt: new Date(),
      decisionNote: 'Approved in test',
      adjustedAmountMinor: null,
      adjustmentReason: null,
    });
    expect(decided).toBe(true);
    expect(await repository.upsertEvaluation({ ...input, summary: 'third' })).toBe('decided');
    const rows = await connection.db
      .select()
      .from(rewardEvaluations)
      .where(eq(rewardEvaluations.policyId, policyId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'approved', summary: 'second', version: 3 });
  });

  it('running the evaluation command twice keeps one evaluation per person', async () => {
    const policyId = await policy();
    const command = new RunRewardEvaluationCommand(
      new DrizzleUnitOfWork(connection.db),
      fixedClock('2026-10-21T04:30:00Z'),
    );
    const context: RequestContext = {
      actor: {
        userId: ownerId,
        role: 'owner',
        capabilities: new Set(DEFAULT_ROLE_CAPABILITIES.owner),
      },
      sessionId: 'integration',
      requestId: 'integration',
    };
    const first = await command.execute(context, policyId, '2026-10-15');
    const second = await command.execute(context, policyId, '2026-10-01');
    expect(second).toEqual(first);
    const [people] = await connection.db
      .select({ total: count() })
      .from(users)
      .where(and(eq(users.status, 'active'), ne(users.role, 'owner')));
    const [stored] = await connection.db
      .select({
        total: count(),
        subjects: sql<number>`count(distinct ${rewardEvaluations.subjectKey})::int`,
      })
      .from(rewardEvaluations)
      .where(eq(rewardEvaluations.policyId, policyId));
    expect(first.evaluated).toBe(people?.total);
    expect(stored).toEqual({ total: people?.total, subjects: people?.total });
  });
});
