import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client } from './support/journey-helpers';
import {
  attachSharedReward,
  completeMilestone,
  projectWithMilestone,
  type RewardPeople,
  rewardPeople,
  sharesOf,
} from './support/reward-helpers';
import { createTestApp, type TestApp } from './support/test-app';

/**
 * Challenges through the real API: only the person a record is about may
 * challenge it, only reviewers (`rewards.decide`) answer, a correction never
 * lowers a reward, and amounts stay hidden from everyone else.
 */
let testApp: TestApp;
let people: RewardPeople;

beforeAll(async () => {
  testApp = await createTestApp();
  people = await rewardPeople(testApp, (token) => client(testApp, token));
});

afterAll(async () => {
  await testApp.close();
});

/** A completed milestone whose lead share was declined and designer share approved at ₹2,500. */
async function decidedShares() {
  const { milestoneId } = await projectWithMilestone(people);
  const plan = await attachSharedReward(people, milestoneId);
  await completeMilestone(testApp, people, milestoneId);
  const shares = await sharesOf(people, plan.id);
  const pick = (userId: string) => {
    const share = shares.find((item) => item.user?.id === userId);
    if (!share) throw new Error('missing share');
    return share;
  };
  const lead = pick(people.ids.lead);
  const designer = pick(people.ids.designer);
  await people.owner
    .post(`/v1/rewards/milestones/${lead.id}/decision`, {
      decision: 'reject',
      note: 'Deliverables were missing.',
      adjustedAmountMinor: null,
      version: lead.version,
    })
    .expect(200);
  await people.owner
    .post(`/v1/rewards/milestones/${designer.id}/decision`, {
      decision: 'approve',
      note: 'Approved at a reduced amount.',
      adjustedAmountMinor: 250_000,
      version: designer.version,
    })
    .expect(200);
  return { lead, designer };
}

describe('reward challenges', () => {
  it('is raised only by the person, once at a time, and answered only by a reviewer', async () => {
    const { lead } = await decidedShares();
    const reason = 'The deliverables were filed on the task on time; please look again.';
    const record = { recordKind: 'milestone', recordId: lead.id, reason };
    await people.colleague.post('/v1/rewards/challenges', record).expect(404);
    await people.designer.post('/v1/rewards/challenges', record).expect(404);
    await people.lead
      .post('/v1/rewards/challenges', { ...record, reason: 'Too short' })
      .expect(400);
    const raised = await people.lead.post('/v1/rewards/challenges', record).expect(201);
    expect(raised.body).toMatchObject({ status: 'open', reason, before: { status: 'rejected' } });
    await people.lead.post('/v1/rewards/challenges', record).expect(422);

    await people.lead.get('/v1/rewards/challenges?scope=review').expect(403);
    await people.admin.get('/v1/rewards/challenges?scope=review').expect(403);
    const answer = {
      outcome: 'uphold',
      note: 'Checked the task files.',
      correctedAmountMinor: null,
      version: 1,
    };
    await people.lead
      .post(`/v1/rewards/challenges/${raised.body.id}/resolution`, answer)
      .expect(403);
    await people.admin
      .post(`/v1/rewards/challenges/${raised.body.id}/resolution`, answer)
      .expect(403);

    const queue = await people.owner
      .get('/v1/rewards/challenges?scope=review&status=open&pageSize=100')
      .expect(200);
    expect(queue.body.items.some((item: { id: string }) => item.id === raised.body.id)).toBe(true);
    const corrected = await people.owner
      .post(`/v1/rewards/challenges/${raised.body.id}/resolution`, {
        ...answer,
        outcome: 'correct',
        note: 'Agreed: the files were there.',
        correctedAmountMinor: 200_000,
      })
      .expect(200);
    expect(corrected.body).toMatchObject({
      status: 'corrected',
      after: { status: 'approved', grantedAmountMinor: 200_000 },
    });
    const mine = await people.lead
      .get('/v1/rewards/milestones?scope=mine&pageSize=100')
      .expect(200);
    const updated = mine.body.items.find((item: { id: string }) => item.id === lead.id);
    expect(updated).toMatchObject({ status: 'approved', adjustedAmountMinor: 200_000 });
    expect(updated.challenges).toHaveLength(1);
    const notices = await testApp.database.pool.query(
      'SELECT kind FROM notifications WHERE subject_id = $1 ORDER BY created_at',
      [raised.body.id],
    );
    expect(notices.rows.map((row: { kind: string }) => row.kind)).toEqual(
      expect.arrayContaining(['reward_review_requested', 'reward_updated']),
    );
    const audit = await testApp.database.pool.query(
      "SELECT action FROM audit_log WHERE entity_type = 'reward_challenge' AND entity_id = $1 ORDER BY created_at",
      [raised.body.id],
    );
    expect(audit.rows.map((row: { action: string }) => row.action)).toEqual([
      'rewards.challenge_raised',
      'rewards.challenge_corrected',
    ]);
    const log = await people.admin
      .get('/v1/audit?entityType=reward_challenge&pageSize=100')
      .expect(200);
    const entry = log.body.items.find(
      (item: { entityId: string; action: string }) =>
        item.entityId === raised.body.id && item.action === 'rewards.challenge_corrected',
    );
    expect(entry.after.record.grantedAmountMinor).toBe('[restricted]');
  });

  it('never lowers a granted reward, and hides amounts from people it is not about', async () => {
    const { designer } = await decidedShares();
    const raised = await people.designer
      .post('/v1/rewards/challenges', {
        recordKind: 'milestone',
        recordId: designer.id,
        reason: 'The reduction did not say which condition was missed.',
      })
      .expect(201);
    expect(raised.body.before.grantedAmountMinor).toBe(250_000);
    expect(raised.body.record.proposedAmountMinor).toBeGreaterThan(0);
    const lower = {
      outcome: 'correct',
      note: 'Lower it',
      correctedAmountMinor: 100_000,
      version: 1,
    };
    await people.owner
      .post(`/v1/rewards/challenges/${raised.body.id}/resolution`, lower)
      .expect(400);
    const upheld = await people.owner
      .post(`/v1/rewards/challenges/${raised.body.id}/resolution`, {
        outcome: 'uphold',
        note: 'The required documents were missing; the note says so now.',
        correctedAmountMinor: null,
        version: 1,
      })
      .expect(200);
    expect(upheld.body.status).toBe('upheld');
    const leadsView = await people.lead
      .get('/v1/rewards/challenges?scope=mine&pageSize=100')
      .expect(200);
    expect(leadsView.body.items.some((item: { id: string }) => item.id === raised.body.id)).toBe(
      false,
    );
  });

  it('works for periodic evaluations too', async () => {
    const policy = await people.owner
      .post('/v1/rewards/policies', {
        name: `Challengeable ${Date.now()}`,
        description: null,
        scope: 'individual',
        period: 'monthly',
        criteria: [{ type: 'on_time_delivery_rate', minimumRate: 1, minimumTasks: 500 }],
        amountMinor: 1_000_00,
        isActive: true,
      })
      .expect(201);
    const periodStart = `${new Date().toISOString().slice(0, 7)}-01`;
    await people.owner
      .post(`/v1/rewards/policies/${policy.body.id}/evaluate`, { periodStart })
      .expect(200);
    const mine = await people.designer
      .get('/v1/rewards/evaluations?scope=mine&pageSize=100')
      .expect(200);
    const evaluation = mine.body.items.find(
      (item: { policy: { id: string } }) => item.policy.id === policy.body.id,
    );
    expect(evaluation).toMatchObject({ status: 'ineligible', challengeable: { allowed: true } });
    const raised = await people.designer
      .post('/v1/rewards/challenges', {
        recordKind: 'evaluation',
        recordId: evaluation.id,
        reason: 'Five of my tasks were finished in this period, not none.',
      })
      .expect(201);
    const after = await people.designer
      .get('/v1/rewards/evaluations?scope=mine&pageSize=100')
      .expect(200);
    const again = after.body.items.find((item: { id: string }) => item.id === evaluation.id);
    expect(again.challenges).toHaveLength(1);
    expect(again.challengeable.allowed).toBe(false);
    expect(raised.body.record.kind).toBe('evaluation');
  });
});
