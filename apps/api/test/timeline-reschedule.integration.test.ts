import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createJourneyProject, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

/**
 * Dragging task bars on the timeline: only the project manager may, the
 * knock-on is shown first, committed deadlines need a reason and keep their
 * history, and moving the agreed end date goes through a scope change.
 */
let testApp: TestApp;
type Client = ReturnType<typeof client>;
const as: Record<'owner' | 'pm' | 'designer' | 'outsider', Client> = {} as never;
let projectId = '';

interface TaskRow {
  id: string;
  title: string;
  status: string;
  plannedStartDate: string;
  dueDate: string;
  version: number;
}

async function task(title: string): Promise<TaskRow> {
  const tasks = await as.pm.get(`/v1/tasks?projectId=${projectId}&pageSize=100`).expect(200);
  const found = tasks.body.items.find((item: TaskRow) => item.title === title);
  if (!found) throw new Error(`No task "${title}"`);
  return found;
}

/** Adds working days by plain calendar days; fine for the small moves in these tests. */
function plusDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

beforeAll(async () => {
  testApp = await createTestApp();
  as.owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
  as.pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
  as.designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
  as.outsider = client(testApp, await signInAs(testApp, '9000000008'));
  projectId = await createJourneyProject(as.owner, {
    pm: await userIdOf(testApp, PEOPLE.projectManager),
    designer: await userIdOf(testApp, PEOPLE.employee),
    lead: await userIdOf(testApp, PEOPLE.teamLead),
    site: await userIdOf(testApp, PEOPLE.siteSupervisor),
  });
});

afterAll(async () => {
  await testApp.close();
});

describe('rescheduling on the timeline', () => {
  it('is only for the project manager', async () => {
    const measure = await task('Measure the site');
    const changes = [
      { taskId: measure.id, plannedStartDate: measure.plannedStartDate, dueDate: measure.dueDate },
    ];
    await as.designer.post(`/v1/projects/${projectId}/reschedule/preview`, { changes }).expect(403);
    await as.outsider.post(`/v1/projects/${projectId}/reschedule/preview`, { changes }).expect(404);
  });

  it('sends a move of the agreed end date through a scope change', async () => {
    const project = await as.pm.get(`/v1/projects/${projectId}`).expect(200);
    const last = await task('Issue good-for-construction drawings');
    const changes = [
      {
        taskId: last.id,
        plannedStartDate: plusDays(last.plannedStartDate, 7),
        dueDate: plusDays(project.body.plannedEndDate, 7),
      },
    ];
    const preview = await as.pm
      .post(`/v1/projects/${projectId}/reschedule/preview`, { changes })
      .expect(200);
    expect(preview.body.requiresScopeChange).toBe(true);
    const refused = await as.pm
      .post(`/v1/projects/${projectId}/reschedule`, { changes, reason: 'Client travelling' })
      .expect(422);
    expect(refused.body.message).toMatch(/Propose a scope change/);
    const proposed = await as.pm
      .post(`/v1/projects/${projectId}/scope-changes`, {
        title: 'Handover after the client returns',
        description: 'The client is travelling until the end of the month.',
        taskShifts: [],
        taskDateChanges: changes,
        newTasks: [],
        cancelTaskIds: [],
      })
      .expect(201);
    expect(proposed.body.impacts[0]).toMatchObject({
      appliesExactDates: true,
      proposedDueDate: changes[0]?.dueDate,
    });
    await as.owner
      .post(`/v1/scope-changes/${proposed.body.id}/decision`, {
        decision: 'approved',
        note: 'Fine by the studio',
        version: proposed.body.version,
      })
      .expect(200);
    const moved = await as.pm.get(`/v1/tasks/${last.id}`).expect(200);
    expect(moved.body).toMatchObject({
      plannedStartDate: changes[0]?.plannedStartDate,
      dueDate: changes[0]?.dueDate,
    });
    const after = await as.pm.get(`/v1/projects/${projectId}`).expect(200);
    expect(after.body.plannedEndDate).toBe(changes[0]?.dueDate);
  });

  // The approved scope change above left a week of slack before the last task.
  it('previews the knock-on, needs a reason, then moves dates with history', async () => {
    const measure = await task('Measure the site');
    const review = await task('Review the site survey');
    const changes = [
      {
        taskId: measure.id,
        plannedStartDate: measure.plannedStartDate,
        dueDate: plusDays(measure.dueDate, 1),
      },
    ];
    const preview = await as.pm
      .post(`/v1/projects/${projectId}/reschedule/preview`, { changes })
      .expect(200);
    const moved = preview.body.moves.map((move: { taskId: string }) => move.taskId);
    expect(moved).toEqual(expect.arrayContaining([measure.id, review.id]));
    expect(preview.body.needsReason).toBe(true);
    expect(preview.body.requiresScopeChange).toBe(false);
    await as.pm.post(`/v1/projects/${projectId}/reschedule`, { changes, reason: null }).expect(400);
    await as.pm
      .post(`/v1/projects/${projectId}/reschedule`, {
        changes,
        reason: 'Site access only from Tuesday',
        expectedVersions: [{ taskId: measure.id, version: measure.version + 5 }],
      })
      .expect(409);
    const applied = await as.pm
      .post(`/v1/projects/${projectId}/reschedule`, {
        changes,
        reason: 'Site access only from Tuesday',
        expectedVersions: [{ taskId: measure.id, version: measure.version }],
      })
      .expect(200);
    expect(applied.body.moved).toBe(preview.body.moves.length);
    const detail = await as.pm.get(`/v1/tasks/${measure.id}`).expect(200);
    expect(detail.body.dueDate).toBe(changes[0]?.dueDate);
    expect(detail.body.scheduleChanges.at(-1).reason).toContain('Site access only from Tuesday');
    const pushed = await as.pm.get(`/v1/tasks/${review.id}`).expect(200);
    expect(pushed.body.scheduleChanges.at(-1).reason).toMatch(/waits for was rescheduled/);
  });
});
