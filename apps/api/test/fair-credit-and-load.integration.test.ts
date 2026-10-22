import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client } from './support/journey-helpers';
import {
  attachSharedReward,
  projectWithMilestone,
  type RewardPeople,
  rewardPeople,
  sharesOf,
} from './support/reward-helpers';
import { createTestApp, type TestApp } from './support/test-app';

/**
 * Fair credit and honest load, found in a live demo: highlights credit the
 * work a milestone waits for, a reward pool overrun is shown and recorded,
 * and one overloaded day makes a person overloaded.
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

/** "YYYY-MM-DD" in India, `days` from today. */
function indiaDate(days = 0): string {
  return new Date(Date.now() + 5.5 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
}

const sql = (text: string, values: unknown[] = []) => testApp.database.pool.query(text, values);

/** Finishes the milestone's tasks and the unlinked work they wait for, then completes it. */
async function deliverMilestone(milestoneId: string) {
  const linked = await sql(
    'SELECT id, owner_user_id FROM tasks WHERE milestone_id = $1 AND parent_task_id IS NULL',
    [milestoneId],
  );
  const feeders = await sql(
    `SELECT t.id, t.owner_user_id FROM task_dependencies d
       JOIN tasks t ON t.id = d.depends_on_task_id
      WHERE d.task_id = ANY($1::uuid[]) AND t.milestone_id IS NULL`,
    [linked.rows.map((row: { id: string }) => row.id)],
  );
  const feeder = feeders.rows[0] as { id: string; owner_user_id: string | null } | undefined;
  if (!feeder) throw new Error('The template milestone has no unlinked feeder task');
  // The feeder is owned by someone who owns none of the milestone's own tasks (the demo's Imran).
  await sql('UPDATE tasks SET owner_user_id = $2 WHERE id = $1', [feeder.id, people.ids.colleague]);
  await sql(
    `UPDATE tasks SET status = 'done', completed_at = now()
      WHERE (milestone_id = $1 OR id = $2) AND status NOT IN ('done', 'cancelled')`,
    [milestoneId, feeder.id],
  );
  const { rows } = await sql('SELECT version FROM milestones WHERE id = $1', [milestoneId]);
  await people.pm
    .post(`/v1/milestones/${milestoneId}/complete`, { note: null, version: rows[0].version })
    .expect(200);
  return feeder.id;
}

describe('performance highlights', () => {
  it('credit the owner of unlinked work the milestone waited for', async () => {
    const { projectId, milestoneId } = await projectWithMilestone(people);
    await deliverMilestone(milestoneId);
    const briefing = await people.owner
      .get(`/v1/dashboard/briefing?projectId=${projectId}&from=${indiaDate(-1)}&to=${indiaDate()}`)
      .expect(200);
    const credited = briefing.body.highlights
      .filter((item: { milestones: { id: string }[] }) =>
        item.milestones.some((milestone) => milestone.id === milestoneId),
      )
      .map((item: { user: { id: string } }) => item.user.id);
    expect(credited).toContain(people.ids.colleague);
    expect(credited.length).toBeGreaterThan(1);
  });
});

describe('milestone reward pool', () => {
  it('warns reviewers and records a total past the pool, without blocking it', async () => {
    const { milestoneId } = await projectWithMilestone(people);
    const plan = await attachSharedReward(people, milestoneId); // 400,001 for designer and lead
    await sql(
      `UPDATE tasks SET status = 'done', completed_at = now() WHERE milestone_id = $1 AND status NOT IN ('done', 'cancelled')`,
      [milestoneId],
    );
    const { rows } = await sql('SELECT version FROM milestones WHERE id = $1', [milestoneId]);
    await people.pm
      .post(`/v1/milestones/${milestoneId}/complete`, { note: null, version: rows[0].version })
      .expect(200);
    const pick = async (userId: string) => {
      const share = (await sharesOf(people, plan.id)).find((item) => item.user?.id === userId);
      if (!share) throw new Error('missing share');
      return share;
    };
    const designer = await pick(people.ids.designer);
    expect(designer.pool).toMatchObject({ grantedMinor: 0, committedMinor: 400_001 });
    await people.owner
      .post(`/v1/rewards/milestones/${designer.id}/decision`, {
        decision: 'approve',
        note: 'Also covered the handover.',
        adjustedAmountMinor: 250_000,
        version: designer.version,
      })
      .expect(200);
    const lead = await pick(people.ids.lead);
    expect(lead.pool).toEqual({
      grantedMinor: 250_000,
      committedMinor: 450_000,
      othersMinor: 250_000,
    });
    await people.owner
      .post(`/v1/rewards/milestones/${lead.id}/decision`, {
        decision: 'approve',
        note: 'Clean sign-off.',
        adjustedAmountMinor: null,
        version: lead.version,
      })
      .expect(200);

    // The person sees their own amounts but not the pool's totals.
    const own = await people.lead.get('/v1/rewards/milestones?scope=mine&pageSize=100').expect(200);
    expect(own.body.items.find((item: { id: string }) => item.id === lead.id).pool).toBeNull();

    const raised = await people.lead
      .post('/v1/rewards/challenges', {
        recordKind: 'milestone',
        recordId: lead.id,
        reason: 'I did a full share of the work as well, please match the other share.',
      })
      .expect(201);
    const queue = await people.owner
      .get('/v1/rewards/challenges?scope=review&status=open&pageSize=100')
      .expect(200);
    const challenge = queue.body.items.find((item: { id: string }) => item.id === raised.body.id);
    expect(challenge.record.pool).toEqual({
      amountMinor: 400_001,
      othersMinor: 250_000,
      sharedBy: 2,
    });
    await people.owner
      .post(`/v1/rewards/challenges/${raised.body.id}/resolution`, {
        outcome: 'correct',
        note: 'Corrected to match.',
        correctedAmountMinor: 250_000,
        version: challenge.version,
      })
      .expect(200);

    const audits = await sql(
      `SELECT action, after FROM audit_log
        WHERE (entity_id = $1 AND action = 'rewards.milestone_reward_approved')
           OR (entity_id = $2 AND action = 'rewards.challenge_corrected')
        ORDER BY created_at`,
      [designer.id, raised.body.id],
    );
    expect(audits.rows.map((row: { after: Record<string, unknown> }) => row.after)).toEqual([
      expect.objectContaining({ poolTotalMinor: 450_000, poolOverrunMinor: 49_999 }),
      expect.objectContaining({ poolTotalMinor: 500_000, poolOverrunMinor: 99_999 }),
    ]);
    const final = await pick(people.ids.lead);
    expect(final.pool).toMatchObject({ grantedMinor: 500_000 });
  });
});

describe('capacity', () => {
  it('flags a person overloaded on one day even when the fortnight looks balanced', async () => {
    const { projectId } = await projectWithMilestone(people);
    const day = indiaDate(1);
    const { rows } = await sql(
      `SELECT id FROM tasks WHERE project_id = $1 AND parent_task_id IS NULL ORDER BY number LIMIT 1`,
      [projectId],
    );
    await sql(
      `UPDATE tasks SET owner_user_id = $2, status = 'ready', estimate_minutes = 1200, actual_minutes = 0,
              planned_start_date = $3, due_date = $3 WHERE id = $1`,
      [rows[0].id, people.ids.colleague, day],
    );
    const overview = await people.owner
      .get(`/v1/capacity?from=${day}&to=${indiaDate(14)}`)
      .expect(200);
    const person = overview.body.people.find(
      (item: { user: { id: string } }) => item.user.id === people.ids.colleague,
    );
    const busy = person.days.find((item: { date: string }) => item.date === day);
    if (!busy.isWorkingDay) return; // A Sunday: the work lands nowhere to overload.
    expect(busy.status).toBe('overloaded');
    expect(person.overloadedDays).toBeGreaterThanOrEqual(1);
    expect(person.status).toBe('overloaded');
    expect(typeof person.totalStatus).toBe('string');
  });
});
