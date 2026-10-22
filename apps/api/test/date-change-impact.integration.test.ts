import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createJourneyProject, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

let testApp: TestApp;
type Client = ReturnType<typeof client>;
const as: Record<'owner' | 'pm' | 'designer' | 'outsider', Client> = {} as never;
let projectId: string;

interface TaskRow {
  readonly id: string;
  readonly title: string;
  readonly plannedStartDate: string | null;
  readonly dueDate: string | null;
}

async function taskByTitle(title: string): Promise<TaskRow> {
  const tasks = await as.pm.get(`/v1/tasks?projectId=${projectId}&pageSize=100`).expect(200);
  const task = tasks.body.items.find((item: TaskRow) => item.title === title);
  if (!task) throw new Error(`No task "${title}"`);
  return task;
}

/** A few days later, never on a Sunday (the studio works Monday to Saturday). */
function laterWorkingDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  if (value.getUTCDay() === 0) value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
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

describe('the impact of a new-date request, before deciding', () => {
  it('shows the waiting work, slipping milestones and forecast, and can move them too', async () => {
    const planning = await taskByTitle('Prepare space planning options');
    const presentation = await taskByTitle('Present the concept to the client');
    if (!planning.dueDate || !presentation.dueDate) throw new Error('Expected dated tasks.');
    const asked = await as.designer
      .post(`/v1/tasks/${planning.id}/date-change-requests`, {
        reason: 'The client asked for a third layout',
        proposedStartDate: null,
        proposedDueDate: laterWorkingDate(planning.dueDate, 2),
      })
      .expect(201);
    const path = `/v1/date-change-requests/${asked.body.id}`;
    await as.outsider.get(`${path}/impact`).expect(404);
    const impact = await as.pm.get(`${path}/impact`).expect(200);
    expect(impact.body.waitingTasks).toContainEqual(
      expect.objectContaining({ taskId: presentation.id }),
    );
    expect(impact.body.dependentMoves).toContainEqual(
      expect.objectContaining({ taskId: presentation.id, isDownstream: true }),
    );
    expect(impact.body.slippingMilestones).toContainEqual(
      expect.objectContaining({ name: 'Concept approved', slipWorkingDays: expect.any(Number) }),
    );
    expect(impact.body.forecastShiftWorkingDays).toBeGreaterThan(0);
    expect(impact.body.movingWaitingTasksNeedsScopeChange).toBe(true);

    const decide = {
      decision: 'accepted',
      note: null,
      version: asked.body.version,
      moveWaitingTasks: true,
    };
    // The waiting work would pass the agreed end: that is a scope change, not a quiet move.
    await as.pm.post(`${path}/decision`, decide).expect(422);

    await testApp.database.pool.query(
      `UPDATE projects SET planned_end_date = planned_end_date + 90 WHERE id = $1`,
      [projectId],
    );
    const roomy = await as.pm.get(`${path}/impact`).expect(200);
    expect(roomy.body.movingWaitingTasksNeedsScopeChange).toBe(false);
    const expected = roomy.body.dependentMoves.find(
      (move: { taskId: string }) => move.taskId === presentation.id,
    );
    await as.pm.post(`${path}/decision`, decide).expect(200);

    const moved = await as.pm.get(`/v1/tasks/${presentation.id}`).expect(200);
    expect(moved.body.dueDate).toBe(expected.proposedDueDate);
    expect(moved.body.plannedStartDate > asked.body.proposedDueDate).toBe(true);
    const planned = await as.pm.get(`/v1/tasks/${planning.id}`).expect(200);
    expect(planned.body.dueDate).toBe(asked.body.proposedDueDate);
    const history = await testApp.database.pool.query(
      'SELECT reason FROM task_schedule_changes WHERE task_id = $1',
      [presentation.id],
    );
    expect(history.rows.map((row: { reason: string }) => row.reason)).toContainEqual(
      expect.stringContaining('got a new date'),
    );
  });
});
