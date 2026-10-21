import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createJourneyProject, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

let testApp: TestApp;
let owner: ReturnType<typeof client>;
let pm: ReturnType<typeof client>;
let designer: ReturnType<typeof client>;
let projectId: string;

interface TaskRow {
  readonly id: string;
  readonly title: string;
  readonly version: number;
  readonly status: string;
  readonly owner: { readonly id: string } | null;
}

async function setWorkTracking(enabled: boolean): Promise<void> {
  const current = await owner.get('/v1/settings/organization').expect(200);
  await owner
    .put('/v1/settings/organization', { ...current.body, workTrackingEnabled: enabled })
    .expect(200);
}

async function designerTask(title: string): Promise<TaskRow> {
  const list = await pm.get(`/v1/tasks?projectId=${projectId}&pageSize=100`).expect(200);
  const task = (list.body.items as TaskRow[]).find((item) => item.title === title);
  if (!task) throw new Error(`No task called ${title}`);
  return task;
}

beforeAll(async () => {
  testApp = await createTestApp();
  owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
  pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
  designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
  projectId = await createJourneyProject(owner, {
    pm: await userIdOf(testApp, PEOPLE.projectManager),
    designer: await userIdOf(testApp, PEOPLE.employee),
    lead: await userIdOf(testApp, PEOPLE.teamLead),
    site: await userIdOf(testApp, PEOPLE.siteSupervisor),
  });
});

afterAll(async () => {
  await setWorkTracking(true);
  await testApp.close();
});

describe('per-task escalation timing', () => {
  it('is a project manager decision and makes the deadline workflow re-plan', async () => {
    const brief = await designerTask('Capture the client brief');
    const before = await pm.get(`/v1/tasks/${brief.id}`).expect(200);
    expect(before.body.escalateAfterOverdueDays).toBeGreaterThanOrEqual(0);
    const updated = await pm
      .patch(`/v1/tasks/${brief.id}`, { escalateAfterOverdueDays: 4, version: brief.version })
      .expect(200);
    expect(updated.body.escalateAfterOverdueDays).toBe(4);
    const events = await testApp.database.pool.query(
      "SELECT count(*)::int AS n FROM outbox_events WHERE event_type = 'TaskScheduleChanged' AND aggregate_id = $1",
      [brief.id],
    );
    expect(events.rows[0]?.n).toBeGreaterThanOrEqual(1);

    const refused = await designer.patch(`/v1/tasks/${brief.id}`, {
      escalateAfterOverdueDays: 2,
      version: updated.body.version,
    });
    expect(refused.status).toBe(403);
    expect(refused.body.message).toMatch(/escalateAfterOverdueDays/);
    const outOfRange = await pm.patch(`/v1/tasks/${brief.id}`, {
      escalateAfterOverdueDays: 0,
      version: updated.body.version,
    });
    expect(outOfRange.status).toBe(400);
  });
});

describe('work tracking switch', () => {
  it('refuses start and pause with an explanation once the studio switches tracking off', async () => {
    const brief = await designerTask('Capture the client brief');
    await designer.post(`/v1/tasks/${brief.id}/acknowledge`).expect(200);
    const started = await designer.post(`/v1/tasks/${brief.id}/work/start`).expect(200);
    expect(started.body.workTrackingEnabled).toBe(true);
    expect(started.body.activeWorkSessionStartedAt).not.toBeNull();

    await setWorkTracking(false);
    const running = await testApp.database.pool.query(
      'SELECT count(*)::int AS n FROM work_sessions WHERE task_id = $1 AND ended_at IS NULL',
      [brief.id],
    );
    expect(running.rows[0]?.n).toBe(0);

    for (const path of ['start', 'pause']) {
      const response = await designer.post(`/v1/tasks/${brief.id}/work/${path}`);
      expect(response.status).toBe(422);
      expect(response.body.code).toBe('PRECONDITION_FAILED');
      expect(response.body.message).toMatch(/Work tracking is switched off/);
      expect(response.body.details[0].message).toMatch(/Move the task with its status instead/);
    }
    const detail = await designer.get(`/v1/tasks/${brief.id}`).expect(200);
    expect(detail.body.workTrackingEnabled).toBe(false);
    expect(detail.body.activeWorkSessionStartedAt).toBeNull();
    const queue = await designer.get('/v1/me/work-queue').expect(200);
    expect(queue.body.workTrackingEnabled).toBe(false);

    await setWorkTracking(true);
    await designer.post(`/v1/tasks/${brief.id}/work/start`).expect(200);
    await designer.post(`/v1/tasks/${brief.id}/work/pause`).expect(200);
  });
});
