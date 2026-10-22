import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createJourneyProject, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

/**
 * A leave handover over its whole life, as in the Mehta & Rao demo: the
 * designer proposes a colleague, both the colleague and (after approval) the
 * project manager find it in their approvals; the handover is applied; the
 * colleague asks to give the task back and the manager accepts, so the leave
 * page shows it handed back and offers cover again. Leave reasons stay with
 * the requester and approvers; people away are flagged for reassignment.
 */
let testApp: TestApp;
const ids = { pm: '', designer: '', colleague: '', lead: '', site: '' };
const COLLEAGUE = '9000000007';
const VISUALISER = '9000000008';
type Client = ReturnType<typeof client>;
interface Item {
  readonly type: string;
  readonly id: string;
}

const approvalsOf = async (as: Client) =>
  ((await as.get('/v1/me/approvals').expect(200)).body as Item[]).filter(
    (item) => item.type === 'leave_handover',
  );

async function notificationKinds(userId: string, subjectId: string): Promise<string[]> {
  const result = await testApp.database.pool.query(
    'SELECT kind FROM notifications WHERE recipient_user_id = $1 AND subject_id = $2',
    [userId, subjectId],
  );
  return result.rows.map((row: { kind: string }) => row.kind);
}

beforeAll(async () => {
  testApp = await createTestApp();
  ids.pm = await userIdOf(testApp, PEOPLE.projectManager);
  ids.designer = await userIdOf(testApp, PEOPLE.employee);
  ids.colleague = await userIdOf(testApp, COLLEAGUE);
  ids.lead = await userIdOf(testApp, PEOPLE.teamLead);
  ids.site = await userIdOf(testApp, PEOPLE.siteSupervisor);
  await testApp.database.pool.query(
    "DELETE FROM leave_requests WHERE user_id = ANY($1) AND status <> 'cancelled'",
    [[ids.designer, ids.colleague]],
  );
});

afterAll(async () => {
  await testApp.close();
});

describe('leave handover, hand back and cover', () => {
  it('routes the handover, keeps reasons private and reopens cover when handed back', async () => {
    const owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
    const pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
    const lead = client(testApp, await signInAs(testApp, PEOPLE.teamLead));
    const designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
    const colleague = client(testApp, await signInAs(testApp, COLLEAGUE));
    const visualiser = client(testApp, await signInAs(testApp, VISUALISER));
    const projectId = await createJourneyProject(owner, ids);
    const tasks = await designer
      .get(`/v1/tasks?projectId=${projectId}&ownerUserId=${ids.designer}`)
      .expect(200);
    const task = tasks.body.items.find((item: { dueDate: string | null }) => item.dueDate);
    const types = await designer.get('/v1/leave/types').expect(200);
    const casual = types.body.find((type: { code: string }) => type.code === 'casual');

    const requested = await designer
      .post('/v1/leave/requests', {
        leaveTypeId: casual.id,
        startDate: task.dueDate,
        endDate: task.dueDate,
        dayPortion: 'full',
        reason: 'Family wedding in Nashik',
        handovers: [{ taskId: task.id, toUserId: ids.colleague, note: null }],
      })
      .expect(201);
    const leaveId = requested.body.id as string;
    const handoverId = requested.body.handovers[0].id as string;

    // The proposed colleague must answer: it is in their approvals and inbox.
    expect(await approvalsOf(colleague)).toContainEqual(
      expect.objectContaining({ id: handoverId, linkPath: `/leave/${leaveId}` }),
    );
    expect(await notificationKinds(ids.colleague, task.id)).toContain('handover_requested');
    expect(await approvalsOf(pm)).toEqual([]);

    // Reasons: the requester and the approver read it; the colleague and the PM do not.
    for (const [viewer, sees] of [
      [designer, true],
      [lead, true],
      [owner, true],
      [colleague, false],
      [pm, false],
    ] as const) {
      const detail = await viewer.get(`/v1/leave/requests/${leaveId}`).expect(200);
      expect(detail.body.reason).toBe(sees ? 'Family wedding in Nashik' : null);
    }
    await visualiser.get(`/v1/leave/requests/${leaveId}`).expect(404);

    let current = requested.body;
    for (const approver of [lead, owner]) {
      if (current.status === 'approved') break;
      current = (
        await approver
          .post(`/v1/leave/requests/${leaveId}/decision`, {
            decision: 'approve',
            note: 'Enjoy the wedding',
            version: current.version,
          })
          .expect(200)
      ).body;
    }
    expect(current.status).toBe('approved');
    const asPm = await pm.get(`/v1/leave/requests/${leaveId}`).expect(200);
    expect(asPm.body.steps.every((step: { note: string | null }) => step.note === null)).toBe(true);
    const team = await lead.get('/v1/leave/requests?scope=team').expect(200);
    expect(team.body.items.find((item: Item) => item.id === leaveId)?.reason).toBe(
      'Family wedding in Nashik',
    );

    // Approved: now the project manager must hand it over, and hears about it.
    expect(await approvalsOf(pm)).toContainEqual(expect.objectContaining({ id: handoverId }));
    expect(await notificationKinds(ids.pm, leaveId)).toContain('handover_requested');

    await colleague
      .post(`/v1/leave/handovers/${handoverId}/decision`, { decision: 'accept', toUserId: null })
      .expect(200);
    const applied = await pm
      .post(`/v1/leave/handovers/${handoverId}/decision`, { decision: 'apply', toUserId: null })
      .expect(200);
    expect(applied.body.handovers[0]).toMatchObject({
      status: 'applied',
      currentOwner: { id: ids.colleague },
      superseded: null,
    });
    expect(await approvalsOf(pm)).toEqual([]);
    expect(await approvalsOf(colleague)).toEqual([]);
    const coverAfter = await pm.get(`/v1/leave/requests/${leaveId}/cover-suggestions`).expect(200);
    expect(coverAfter.body.tasks.map((item: { task: Item }) => item.task.id)).not.toContain(
      task.id,
    );
    await pm
      .post(`/v1/leave/handovers/${handoverId}/decision`, { decision: 'apply', toUserId: ids.site })
      .expect(422);

    // The colleague asks to give it back; the manager accepts, onto the leave days.
    const asked = await colleague
      .post(`/v1/tasks/${task.id}/reassignment-requests`, {
        reason: 'Too much on my plate',
        suggestedUserId: ids.designer,
      })
      .expect(201);
    await pm
      .post(`/v1/reassignment-requests/${asked.body.id}/decision`, {
        decision: 'accepted',
        newOwnerUserId: null,
        note: null,
        version: asked.body.version,
      })
      .expect(200);

    const back = await pm.get(`/v1/leave/requests/${leaveId}`).expect(200);
    expect(back.body.handovers[0]).toMatchObject({
      status: 'applied',
      to: { id: ids.colleague },
      currentOwner: { id: ids.designer },
      superseded: { handedBack: true },
    });
    expect(back.body.handovers[0].superseded.at).toEqual(expect.any(String));
    expect(
      back.body.impact.conflicts.map((conflict: { taskId: string }) => conflict.taskId),
    ).toContain(task.id);
    const cover = await pm.get(`/v1/leave/requests/${leaveId}/cover-suggestions`).expect(200);
    const covered = cover.body.tasks.find((item: { task: Item }) => item.task.id === task.id);
    expect(covered.handover).toMatchObject({ id: handoverId, handedBack: true });
    expect(covered.suggestions.map((item: { user: Item }) => item.user.id)).not.toContain(
      ids.designer,
    );
    expect(await approvalsOf(pm)).toContainEqual(expect.objectContaining({ id: handoverId }));

    // Who is away while the task runs: dates for the reassigner only, never the reason.
    const away = await pm.get(`/v1/leave/away-during-task/${task.id}`).expect(200);
    const designerAway = away.body.people.find(
      (person: { user: Item }) => person.user.id === ids.designer,
    );
    expect(designerAway).toMatchObject({ startDate: task.dueDate, status: 'approved' });
    expect(JSON.stringify(away.body)).not.toContain('Nashik');
    await colleague.get(`/v1/leave/away-during-task/${task.id}`).expect(403);
    await visualiser.get(`/v1/leave/away-during-task/${task.id}`).expect(404);

    // The manager chooses cover again from the leave page.
    await pm
      .post(`/v1/leave/handovers/${handoverId}/decision`, { decision: 'apply', toUserId: null })
      .expect(400);
    const again = await pm
      .post(`/v1/leave/handovers/${handoverId}/decision`, {
        decision: 'apply',
        toUserId: ids.colleague,
      })
      .expect(200);
    expect(again.body.handovers[0]).toMatchObject({
      currentOwner: { id: ids.colleague },
      superseded: null,
    });
    expect(await approvalsOf(pm)).toEqual([]);
  });
});
