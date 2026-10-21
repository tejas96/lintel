import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createJourneyProject, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

let testApp: TestApp;
type Client = ReturnType<typeof client>;
const as: Record<'owner' | 'pm' | 'designer' | 'lead' | 'outsider', Client> = {} as never;
const ids = { pm: '', designer: '', lead: '', other: '' };
let projectId: string;

interface TaskRow {
  readonly id: string;
  readonly title: string;
  readonly version: number;
  readonly owner: { id: string } | null;
}

async function taskTitled(title: string): Promise<TaskRow> {
  const tasks = await as.pm.get(`/v1/tasks?projectId=${projectId}&pageSize=100`).expect(200);
  return tasks.body.items.find((task: TaskRow) => task.title === title);
}

/** Notifications of one kind about one subject (a request or a task), so earlier runs do not count. */
async function notificationsFor(
  userId: string,
  kind: string,
  subjectId: string,
): Promise<string[]> {
  const result = await testApp.database.pool.query(
    'SELECT title FROM notifications WHERE recipient_user_id = $1 AND kind = $2 AND subject_id = $3',
    [userId, kind, subjectId],
  );
  return result.rows.map((row: { title: string }) => row.title);
}

beforeAll(async () => {
  testApp = await createTestApp();
  as.owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
  as.pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
  as.designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
  as.lead = client(testApp, await signInAs(testApp, PEOPLE.teamLead));
  as.outsider = client(testApp, await signInAs(testApp, '9000000008'));
  ids.pm = await userIdOf(testApp, PEOPLE.projectManager);
  ids.designer = await userIdOf(testApp, PEOPLE.employee);
  ids.lead = await userIdOf(testApp, PEOPLE.teamLead);
  ids.other = await userIdOf(testApp, '9000000007');
  projectId = await createJourneyProject(as.owner, {
    pm: ids.pm,
    designer: ids.designer,
    lead: ids.lead,
    site: await userIdOf(testApp, PEOPLE.siteSupervisor),
  });
});

afterAll(async () => {
  await testApp.close();
});

describe('reassignment requests', () => {
  it('lets the owner ask once, and only the project manager decide', async () => {
    const brief = await taskTitled('Capture the client brief');
    expect(brief.owner?.id).toBe(ids.designer);
    await as.outsider
      .post(`/v1/tasks/${brief.id}/reassignment-requests`, {
        reason: 'Not mine',
        suggestedUserId: null,
      })
      .expect(404);
    await as.lead
      .post(`/v1/tasks/${brief.id}/reassignment-requests`, {
        reason: 'Let me take it',
        suggestedUserId: null,
      })
      .expect(403);
    const asked = await as.designer
      .post(`/v1/tasks/${brief.id}/reassignment-requests`, {
        reason: 'I am on another site all week',
        suggestedUserId: ids.other,
      })
      .expect(201);
    expect(asked.body).toMatchObject({
      status: 'open',
      viewerCanDecide: false,
      viewerCanWithdraw: true,
    });
    await as.designer
      .post(`/v1/tasks/${brief.id}/reassignment-requests`, {
        reason: 'Asking again',
        suggestedUserId: null,
      })
      .expect(409);
    expect(await notificationsFor(ids.pm, 'reassignment_requested', asked.body.id)).toHaveLength(1);

    const queue = await as.pm.get('/v1/me/approvals').expect(200);
    expect(queue.body).toContainEqual(
      expect.objectContaining({ type: 'reassignment_request', id: asked.body.id }),
    );
    const designerQueue = await as.designer.get('/v1/me/approvals').expect(200);
    expect(designerQueue.body.some((item: { id: string }) => item.id === asked.body.id)).toBe(
      false,
    );

    const body = {
      decision: 'accepted',
      newOwnerUserId: null,
      note: null,
      version: asked.body.version,
    };
    await as.designer.post(`/v1/reassignment-requests/${asked.body.id}/decision`, body).expect(403);
    await as.lead.post(`/v1/reassignment-requests/${asked.body.id}/decision`, body).expect(403);
    await as.outsider.post(`/v1/reassignment-requests/${asked.body.id}/decision`, body).expect(404);

    const accepted = await as.pm
      .post(`/v1/reassignment-requests/${asked.body.id}/decision`, body)
      .expect(200);
    expect(accepted.body).toMatchObject({ status: 'accepted', newOwner: { id: ids.other } });
    const after = await as.pm.get(`/v1/tasks/${brief.id}`).expect(200);
    expect(after.body.owner.id).toBe(ids.other);
    expect(await notificationsFor(ids.other, 'task_assigned', brief.id)).not.toHaveLength(0);
    expect(await notificationsFor(ids.designer, 'reassignment_decided', asked.body.id)).toEqual([
      'Reassignment accepted',
    ]);
    const audit = await testApp.database.pool.query(
      "SELECT action FROM audit_log WHERE entity_id = $1 AND action LIKE 'task.%' ORDER BY created_at",
      [brief.id],
    );
    expect(audit.rows.map((row: { action: string }) => row.action)).toContain('task.assigned');
    await as.pm.post(`/v1/reassignment-requests/${asked.body.id}/decision`, body).expect(409);
  });

  it('never lets a manager decide a request they made themselves', async () => {
    const review = await taskTitled('Review the site survey');
    expect(review.owner?.id).toBe(ids.pm);
    const asked = await as.pm
      .post(`/v1/tasks/${review.id}/reassignment-requests`, {
        reason: 'Client meetings all week',
        suggestedUserId: ids.lead,
      })
      .expect(201);
    expect(asked.body.viewerCanDecide).toBe(false);
    await as.pm
      .post(`/v1/reassignment-requests/${asked.body.id}/decision`, {
        decision: 'accepted',
        newOwnerUserId: ids.lead,
        note: null,
        version: asked.body.version,
      })
      .expect(403);
    const ownerQueue = await as.owner.get('/v1/me/approvals').expect(200);
    expect(ownerQueue.body.some((item: { id: string }) => item.id === asked.body.id)).toBe(true);
    const declined = await as.owner
      .post(`/v1/reassignment-requests/${asked.body.id}/decision`, {
        decision: 'declined',
        newOwnerUserId: null,
        note: 'Keep it; the survey review needs you',
        version: asked.body.version,
      })
      .expect(200);
    expect(declined.body.status).toBe('declined');
    expect(await notificationsFor(ids.pm, 'reassignment_decided', asked.body.id)).toEqual([
      'Reassignment declined',
    ]);
  });

  it('needs a note to decline and lets the requester withdraw instead', async () => {
    const survey = await taskTitled('Measure the site');
    const site = client(testApp, await signInAs(testApp, PEOPLE.siteSupervisor));
    const asked = await site
      .post(`/v1/tasks/${survey.id}/reassignment-requests`, {
        reason: 'Away on leave',
        suggestedUserId: null,
      })
      .expect(201);
    await as.pm
      .post(`/v1/reassignment-requests/${asked.body.id}/decision`, {
        decision: 'declined',
        newOwnerUserId: null,
        note: null,
        version: asked.body.version,
      })
      .expect(400);
    const listed = await as.pm.get(`/v1/tasks/${survey.id}/reassignment-requests`).expect(200);
    expect(listed.body.requests[0]).toMatchObject({ status: 'open', viewerCanDecide: true });
    const withdrawn = await site
      .post(`/v1/reassignment-requests/${asked.body.id}/withdraw`, { version: asked.body.version })
      .expect(200);
    expect(withdrawn.body.status).toBe('withdrawn');
    const after = await site.get(`/v1/tasks/${survey.id}/reassignment-requests`).expect(200);
    expect(after.body.viewerCanRequest).toBe(true);
  });
});
