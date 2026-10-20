import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createJourneyProject, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

/**
 * People operations through the real API: a leave request that collides with
 * work → two-level approval → handover accepted and applied → capacity shows
 * the leave → notifications → idempotent reward evaluation → restricted data.
 */
let testApp: TestApp;
const ids = { pm: '', designer: '', colleague: '', lead: '', site: '' };

beforeAll(async () => {
  testApp = await createTestApp();
  ids.pm = await userIdOf(testApp, PEOPLE.projectManager);
  ids.designer = await userIdOf(testApp, PEOPLE.employee);
  ids.colleague = await userIdOf(testApp, '9000000007');
  ids.lead = await userIdOf(testApp, PEOPLE.teamLead);
  ids.site = await userIdOf(testApp, PEOPLE.siteSupervisor);
  await testApp.database.pool.query(
    "DELETE FROM leave_requests WHERE user_id = $1 AND status <> 'cancelled'",
    [ids.designer],
  );
});

afterAll(async () => {
  await testApp.close();
});

describe('people operations journey', () => {
  it('handles leave with conflicts, approvals, handover and capacity', async () => {
    const owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
    const pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
    const lead = client(testApp, await signInAs(testApp, PEOPLE.teamLead));
    const designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
    const colleague = client(testApp, await signInAs(testApp, '9000000007'));
    const projectId = await createJourneyProject(owner, ids);

    // 12. The designer's own task falls inside the requested leave.
    const tasks = await designer
      .get(`/v1/tasks?projectId=${projectId}&ownerUserId=${ids.designer}`)
      .expect(200);
    const task = tasks.body.items.find((item: { dueDate: string | null }) => item.dueDate);
    const types = await designer.get('/v1/leave/types').expect(200);
    const casual = types.body.find((type: { code: string }) => type.code === 'casual');
    const period = {
      leaveTypeId: casual.id,
      startDate: task.dueDate,
      endDate: task.dueDate,
      dayPortion: 'full',
    };
    const preview = await designer
      .post('/v1/leave/preview', { ...period, userId: null, reason: null })
      .expect(200);
    expect(
      preview.body.conflicts.some((conflict: { taskId: string }) => conflict.taskId === task.id),
    ).toBe(true);
    expect(preview.body.blockingProblems).toEqual([]);

    // 13. Submit with a handover proposal; the lead (and owner if needed) approve.
    const requested = await designer
      .post('/v1/leave/requests', {
        ...period,
        reason: 'Family function',
        handovers: [
          { taskId: task.id, toUserId: ids.colleague, note: 'Draft is in the shared folder' },
        ],
      })
      .expect(201);
    expect(requested.body.status).toBe('pending');
    expect(requested.body.steps[0].approver.id).toBe(ids.lead);
    await colleague
      .post(`/v1/leave/requests/${requested.body.id}/decision`, {
        decision: 'approve',
        note: null,
        version: requested.body.version,
      })
      .expect((response) => expect([403, 404]).toContain(response.status));
    let current = requested.body;
    for (const approver of [lead, owner]) {
      if (current.status === 'approved') break;
      const decided = await approver
        .post(`/v1/leave/requests/${current.id}/decision`, {
          decision: 'approve',
          note: 'Enjoy',
          version: current.version,
        })
        .expect(200);
      current = decided.body;
    }
    expect(current.status).toBe('approved');

    // 14. The colleague accepts the handover; the project manager applies it.
    const handover = current.handovers[0];
    await colleague
      .post(`/v1/leave/handovers/${handover.id}/decision`, { decision: 'accept', toUserId: null })
      .expect(200);
    await pm
      .post(`/v1/leave/handovers/${handover.id}/decision`, { decision: 'apply', toUserId: null })
      .expect(200);
    const reassigned = await pm.get(`/v1/tasks/${task.id}`).expect(200);
    expect(reassigned.body.owner.id).toBe(ids.colleague);

    const capacity = await lead
      .get(`/v1/capacity?from=${task.dueDate}&to=${task.dueDate}`)
      .expect(200);
    const designerDay = capacity.body.people.find(
      (person: { user: { id: string } }) => person.user.id === ids.designer,
    ).days[0];
    expect(designerDay.leave).toBe('approved');
    expect(designerDay.availableMinutes).toBe(0);
    const ownCapacity = await designer
      .get(`/v1/capacity?from=${task.dueDate}&to=${task.dueDate}`)
      .expect(200);
    expect(
      ownCapacity.body.people.map((person: { user: { id: string } }) => person.user.id),
    ).toEqual([ids.designer]);
  });

  it('notifies people and keeps the inbox personal', async () => {
    const designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
    const inbox = await designer.get('/v1/notifications').expect(200);
    expect(inbox.body.unreadCount).toBeGreaterThan(0);
    await designer.post('/v1/notifications/read-all').expect(204);
    const after = await designer.get('/v1/notifications?unreadOnly=true').expect(200);
    expect(after.body.unreadCount).toBe(0);
  });

  it('evaluates rewards idempotently and restricts compensation data', async () => {
    const owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
    const designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
    const policy = await owner
      .post('/v1/rewards/policies', {
        name: `Reliable delivery ${Date.now()}`,
        description: null,
        scope: 'individual',
        period: 'monthly',
        criteria: [{ type: 'on_time_delivery_rate', minimumRate: 0.5, minimumTasks: 1 }],
        amountMinor: 5_000_00,
        isActive: true,
      })
      .expect(201);
    const periodStart = `${new Date().toISOString().slice(0, 7)}-01`;
    const first = await owner
      .post(`/v1/rewards/policies/${policy.body.id}/evaluate`, { periodStart })
      .expect(200);
    const second = await owner
      .post(`/v1/rewards/policies/${policy.body.id}/evaluate`, { periodStart })
      .expect(200);
    expect(second.body.evaluated).toBe(first.body.evaluated);
    const rows = await testApp.database.pool.query(
      'SELECT count(*)::int AS count FROM reward_evaluations WHERE policy_id = $1',
      [policy.body.id],
    );
    expect(rows.rows[0].count).toBe(first.body.evaluated);

    const all = await owner.get('/v1/rewards/evaluations?scope=all&pageSize=100').expect(200);
    const mine = all.body.items.filter(
      (item: { policy: { id: string } }) => item.policy.id === policy.body.id,
    );
    expect(mine.length).toBe(first.body.evaluated);
    for (const evaluation of mine)
      expect(evaluation.criteria[0].explanation.length).toBeGreaterThan(10);

    await designer.get('/v1/rewards/evaluations?scope=all').expect(403);
    await designer.get('/v1/dashboard/command-center').expect(403);
    await designer
      .post('/v1/rewards/policies', { name: 'x' })
      .expect((response) => expect([400, 403]).toContain(response.status));
  });
});
