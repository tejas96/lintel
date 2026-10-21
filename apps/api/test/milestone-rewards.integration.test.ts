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
 * Milestone rewards through the real API: who may attach them, the check at
 * completion, who sees amounts, and who decides.
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

describe('milestone rewards', () => {
  it('lets owners and administrators attach a reward to people on the project only', async () => {
    const { projectId, milestoneId } = await projectWithMilestone(people);
    const body = {
      scope: 'individual',
      recipientUserIds: [people.ids.designer],
      amountMinor: 300_000,
      requiredDocumentFolders: ['drawings'],
      note: null,
      version: null,
    };
    await people.pm.put(`/v1/milestones/${milestoneId}/reward`, body).expect(403);
    await people.designer.put(`/v1/milestones/${milestoneId}/reward`, body).expect(403);
    await people.admin
      .put(`/v1/milestones/${milestoneId}/reward`, {
        ...body,
        recipientUserIds: [people.ids.colleague],
      })
      .expect(400);
    const saved = await people.admin.put(`/v1/milestones/${milestoneId}/reward`, body).expect(200);
    expect(saved.body).toMatchObject({ state: 'planned', amountMinor: 300_000 });
    expect(saved.body.conditions.join(' ')).toContain('Drawings is in the project documents.');
    await people.admin.put(`/v1/milestones/${milestoneId}/reward`, body).expect(409);
    const shared = await attachSharedRewardAt(milestoneId, saved.body.version);
    expect(
      shared.recipients.map((share: { shareAmountMinor: number }) => share.shareAmountMinor),
    ).toEqual([200_001, 200_000].sort((a, b) => b - a));
    await people.designer.get(`/v1/projects/${projectId}/milestone-rewards`).expect(403);
    await people.pm.get(`/v1/projects/${projectId}/milestone-rewards`).expect(403);
    const listed = await people.owner
      .get(`/v1/projects/${projectId}/milestone-rewards`)
      .expect(200);
    expect(listed.body).toHaveLength(1);
    const audit = await testApp.database.pool.query(
      "SELECT action FROM audit_log WHERE entity_type = 'milestone_reward' AND entity_id = $1 ORDER BY created_at",
      [saved.body.id],
    );
    expect(audit.rows.map((row: { action: string }) => row.action)).toEqual([
      'rewards.milestone_reward_attached',
      'rewards.milestone_reward_changed',
    ]);
  });

  it('checks the reward at completion and waits for a reviewer, never granting by itself', async () => {
    const { milestoneId } = await projectWithMilestone(people);
    const plan = await attachSharedReward(people, milestoneId);
    await completeMilestone(testApp, people, milestoneId);
    const shares = await sharesOf(people, plan.id);
    expect(shares).toHaveLength(2);
    for (const share of shares as { status: string; criteria: unknown[]; decidedBy: unknown }[]) {
      expect(share.status).toBe('pending_review');
      expect(share.criteria).toHaveLength(4);
      expect(share.decidedBy).toBeNull();
    }
    const notices = await testApp.database.pool.query(
      'SELECT kind FROM notifications WHERE recipient_user_id = $1 AND subject_id = $2 ORDER BY created_at',
      [people.ids.designer, plan.id],
    );
    expect(notices.rows.map((row: { kind: string }) => row.kind)).toEqual([
      'reward_updated',
      'reward_updated',
    ]);
    await people.admin
      .post(`/v1/milestones/${milestoneId}/reward/withdraw`, {
        version: plan.version,
        reason: 'Too late now',
      })
      .expect((response) => expect([409, 422]).toContain(response.status));
  });

  it('shows amounts only to the person and rewards.view_all, and lets only reviewers decide', async () => {
    const { milestoneId } = await projectWithMilestone(people);
    const plan = await attachSharedReward(people, milestoneId);
    await completeMilestone(testApp, people, milestoneId);
    const mine = await people.designer
      .get('/v1/rewards/milestones?scope=mine&pageSize=100')
      .expect(200);
    const own = mine.body.items.find((item: { planId: string }) => item.planId === plan.id);
    expect(own.user.id).toBe(people.ids.designer);
    expect(own.shareAmountMinor).toBeGreaterThan(0);
    expect(
      mine.body.items.every(
        (item: { user: { id: string } }) => item.user.id === people.ids.designer,
      ),
    ).toBe(true);
    await people.designer.get('/v1/rewards/milestones?scope=all').expect(403);
    await people.admin.get('/v1/rewards/milestones?scope=all').expect(403);
    const outsider = await people.colleague.get('/v1/rewards/milestones?scope=mine').expect(200);
    expect(outsider.body.items.some((item: { planId: string }) => item.planId === plan.id)).toBe(
      false,
    );

    const [designerShare] = (await sharesOf(people, plan.id)).filter(
      (item) => item.user.id === people.ids.designer,
    ) as { id: string; version: number }[];
    if (!designerShare) throw new Error('missing share');
    const approve = {
      decision: 'approve',
      note: 'Clean sign-off',
      adjustedAmountMinor: null,
      version: designerShare.version,
    };
    await people.admin
      .post(`/v1/rewards/milestones/${designerShare.id}/decision`, approve)
      .expect(403);
    await people.lead
      .post(`/v1/rewards/milestones/${designerShare.id}/decision`, approve)
      .expect(403);
    const decided = await people.owner
      .post(`/v1/rewards/milestones/${designerShare.id}/decision`, {
        ...approve,
        adjustedAmountMinor: 250_000,
      })
      .expect(200);
    expect(decided.body).toMatchObject({ status: 'approved', adjustedAmountMinor: 250_000 });
    await people.owner
      .post(`/v1/rewards/milestones/${designerShare.id}/decision`, approve)
      .expect(422);
  });
});

async function attachSharedRewardAt(milestoneId: string, version: number) {
  const changed = await people.owner
    .put(`/v1/milestones/${milestoneId}/reward`, {
      scope: 'team',
      recipientUserIds: [people.ids.lead, people.ids.designer],
      amountMinor: 400_001,
      requiredDocumentFolders: [],
      note: 'Shared now',
      version,
    })
    .expect(200);
  return changed.body;
}
