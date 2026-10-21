import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createJourneyProject, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

let testApp: TestApp;
type Client = ReturnType<typeof client>;
const as: Record<'owner' | 'pm' | 'designer' | 'lead' | 'outsider', Client> = {} as never;
const ids = { pm: '', designer: '' };
let projectId: string;

interface TaskRow {
  readonly id: string;
  readonly dueDate: string | null;
  readonly owner: { id: string } | null;
}

async function designerTasks(): Promise<TaskRow[]> {
  const tasks = await as.pm
    .get(`/v1/tasks?projectId=${projectId}&ownerUserId=${ids.designer}&pageSize=100`)
    .expect(200);
  return tasks.body.items.filter((task: TaskRow) => task.dueDate);
}

function laterDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function rows(sql: string, values: unknown[]) {
  return (await testApp.database.pool.query(sql, values)).rows;
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
  projectId = await createJourneyProject(as.owner, {
    pm: ids.pm,
    designer: ids.designer,
    lead: await userIdOf(testApp, PEOPLE.teamLead),
    site: await userIdOf(testApp, PEOPLE.siteSupervisor),
  });
});

afterAll(async () => {
  await testApp.close();
});

describe('new-date requests', () => {
  it('lets the owner ask once; only the project manager accepts, with history kept', async () => {
    const [task] = await designerTasks();
    if (!task?.dueDate) throw new Error('The journey project needs a dated task.');
    const proposedDueDate = laterDate(task.dueDate, 3);
    const ask = {
      reason: 'Waiting for the client brief',
      proposedStartDate: null,
      proposedDueDate,
    };
    await as.outsider.post(`/v1/tasks/${task.id}/date-change-requests`, ask).expect(404);
    await as.lead.post(`/v1/tasks/${task.id}/date-change-requests`, ask).expect(403);
    await as.designer
      .post(`/v1/tasks/${task.id}/date-change-requests`, { ...ask, reason: 'x' })
      .expect(400);
    const asked = await as.designer
      .post(`/v1/tasks/${task.id}/date-change-requests`, ask)
      .expect(201);
    expect(asked.body).toMatchObject({
      status: 'open',
      previousDueDate: task.dueDate,
      proposedDueDate,
      viewerCanDecide: false,
      viewerCanWithdraw: true,
    });
    await as.designer.post(`/v1/tasks/${task.id}/date-change-requests`, ask).expect(409);
    expect(
      await rows(
        'SELECT 1 FROM notifications WHERE recipient_user_id = $1 AND kind = $2 AND subject_id = $3',
        [ids.pm, 'date_change_requested', asked.body.id],
      ),
    ).toHaveLength(1);
    const queue = await as.pm.get('/v1/me/approvals').expect(200);
    expect(queue.body).toContainEqual(
      expect.objectContaining({ type: 'date_change_request', id: asked.body.id }),
    );

    const decide = { decision: 'accepted', note: null, version: asked.body.version };
    const path = `/v1/date-change-requests/${asked.body.id}/decision`;
    await as.designer.post(path, decide).expect(403);
    await as.lead.post(path, decide).expect(403);
    await as.outsider.post(path, decide).expect(404);
    const listed = await as.pm.get(`/v1/tasks/${task.id}/date-change-requests`).expect(200);
    expect(listed.body.requests[0]).toMatchObject({ id: asked.body.id, viewerCanDecide: true });

    const accepted = await as.pm.post(path, decide).expect(200);
    expect(accepted.body).toMatchObject({ status: 'accepted', decidedBy: { id: ids.pm } });
    await as.pm.post(path, { ...decide, version: accepted.body.version }).expect(409);
    const after = await as.pm.get(`/v1/tasks/${task.id}`).expect(200);
    expect(after.body.dueDate).toBe(proposedDueDate);
    expect(after.body.baselineDueDate).toBe(task.dueDate);
    expect(
      await rows(
        'SELECT previous_due_date::text AS previous, new_due_date::text AS next, reason FROM task_schedule_changes WHERE date_change_request_id = $1',
        [asked.body.id],
      ),
    ).toEqual([
      {
        previous: task.dueDate,
        next: proposedDueDate,
        reason: 'New date requested: Waiting for the client brief',
      },
    ]);
    expect(
      await rows('SELECT action FROM audit_log WHERE entity_id = $1 ORDER BY created_at', [
        asked.body.id,
      ]),
    ).toEqual([{ action: 'task.date_change_requested' }, { action: 'task.date_change_accepted' }]);
    expect(
      await rows(
        'SELECT title FROM notifications WHERE recipient_user_id = $1 AND kind = $2 AND subject_id = $3',
        [ids.designer, 'date_change_decided', asked.body.id],
      ),
    ).toEqual([{ title: 'New date accepted' }]);
    const events = await rows(
      `SELECT 1 FROM outbox_events WHERE event_type = 'TaskScheduleChanged' AND aggregate_id = $1`,
      [task.id],
    );
    expect(events.length).toBeGreaterThan(0);
  });

  it('needs a note to decline, and lets only the person who asked withdraw', async () => {
    const [, task] = await designerTasks();
    if (!task?.dueDate) throw new Error('The journey project needs a second dated task.');
    const asked = await as.designer
      .post(`/v1/tasks/${task.id}/date-change-requests`, {
        reason: 'Site access only next week',
        proposedStartDate: null,
        proposedDueDate: laterDate(task.dueDate, 2),
      })
      .expect(201);
    const path = `/v1/date-change-requests/${asked.body.id}`;
    await as.pm
      .post(`${path}/decision`, { decision: 'declined', note: null, version: asked.body.version })
      .expect(400);
    await as.pm.post(`${path}/withdraw`, { version: asked.body.version }).expect(403);
    const withdrawn = await as.designer
      .post(`${path}/withdraw`, { version: asked.body.version })
      .expect(200);
    expect(withdrawn.body.status).toBe('withdrawn');
    const unchanged = await as.pm.get(`/v1/tasks/${task.id}`).expect(200);
    expect(unchanged.body.dueDate).toBe(task.dueDate);
  });
});
