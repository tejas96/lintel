import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createJourneyProject, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

let testApp: TestApp;
type Client = ReturnType<typeof client>;
const as: Record<'owner' | 'admin' | 'pm' | 'designer' | 'outsider', Client> = {} as never;
const ids = { designer: '', outsider: '' };
let projectId: string;

interface TaskRow {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly dueDate: string;
  readonly stage: { id: string } | null;
}

async function tasksByTitle(): Promise<Map<string, TaskRow>> {
  const tasks = await as.pm
    .get(`/v1/tasks?projectId=${projectId}&status=all&pageSize=100`)
    .expect(200);
  return new Map(tasks.body.items.map((task: TaskRow) => [task.title, task]));
}

beforeAll(async () => {
  testApp = await createTestApp();
  as.owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
  as.admin = client(testApp, await signInAs(testApp, PEOPLE.administrator));
  as.pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
  as.designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
  as.outsider = client(testApp, await signInAs(testApp, '9000000008'));
  ids.designer = await userIdOf(testApp, PEOPLE.employee);
  ids.outsider = await userIdOf(testApp, '9000000008');
  projectId = await createJourneyProject(as.owner, {
    pm: await userIdOf(testApp, PEOPLE.projectManager),
    designer: ids.designer,
    lead: await userIdOf(testApp, PEOPLE.teamLead),
    site: await userIdOf(testApp, PEOPLE.siteSupervisor),
  });
});

afterAll(async () => {
  await testApp.close();
});

describe('scope changes that add and cancel tasks', () => {
  it('previews, proposes and applies additions and cancellations atomically with history', async () => {
    const tasks = await tasksByTitle();
    const brief = tasks.get('Capture the client brief');
    const moodBoard = tasks.get('Build the mood board');
    if (!brief?.stage || !moodBoard) throw new Error('Unexpected plan');
    const request = {
      taskShifts: [],
      newTasks: [
        {
          title: 'Survey the terrace',
          stageId: brief.stage.id,
          plannedStartDate: brief.dueDate,
          dueDate: brief.dueDate,
          ownerUserId: ids.designer,
          priority: 'high',
        },
      ],
      cancelTaskIds: [moodBoard.id],
    };
    const outsiderOwner = {
      ...request,
      newTasks: [{ ...request.newTasks[0], ownerUserId: ids.outsider }],
    };
    const refused = await as.pm
      .post(`/v1/projects/${projectId}/scope-changes/preview`, outsiderOwner)
      .expect(400);
    expect(refused.body.details[0].field).toBe('newTasks.0.ownerUserId');
    await as.pm
      .post(`/v1/projects/${projectId}/scope-changes/preview`, {
        taskShifts: [],
        newTasks: [],
        cancelTaskIds: [],
      })
      .expect(400);
    const preview = await as.pm
      .post(`/v1/projects/${projectId}/scope-changes/preview`, request)
      .expect(200);
    expect(preview.body.cancellations).toEqual([
      { taskId: moodBoard.id, taskTitle: 'Build the mood board' },
    ]);
    expect(preview.body.newTasks[0].title).toBe('Survey the terrace');

    const proposed = await as.pm
      .post(`/v1/projects/${projectId}/scope-changes`, {
        ...request,
        title: 'Terrace instead of the mood board',
        description: 'The client wants the terrace surveyed and has chosen materials already.',
      })
      .expect(201);
    expect(proposed.body.newTasks[0]).toMatchObject({
      title: 'Survey the terrace',
      createdTask: null,
    });
    expect(proposed.body.cancellations[0]).toMatchObject({ outcome: 'pending' });
    expect((await tasksByTitle()).get('Survey the terrace')).toBeUndefined();

    await as.pm
      .post(`/v1/scope-changes/${proposed.body.id}/decision`, {
        decision: 'approved',
        note: 'Agreed with the client',
        version: proposed.body.version,
      })
      .expect(403);
    const decided = await as.admin
      .post(`/v1/scope-changes/${proposed.body.id}/decision`, {
        decision: 'approved',
        note: 'Agreed with the client',
        version: proposed.body.version,
      })
      .expect(200);
    expect(decided.body.status).toBe('approved');
    expect(decided.body.newTasks[0].createdTask).toMatchObject({ title: 'Survey the terrace' });
    expect(decided.body.cancellations[0]).toMatchObject({ outcome: 'cancelled' });

    const after = await tasksByTitle();
    const terrace = after.get('Survey the terrace');
    expect(terrace?.status).toBe('ready');
    expect(after.get('Build the mood board')?.status).toBe('cancelled');
    const detail = await as.designer.get(`/v1/tasks/${terrace?.id}`).expect(200);
    expect(detail.body.owner.id).toBe(ids.designer);
    expect(detail.body.scheduleChanges[0].reason).toContain('Terrace instead of the mood board');
    const notices = await testApp.database.pool.query(
      "SELECT title FROM notifications WHERE recipient_user_id = $1 AND kind = 'task_assigned' AND subject_id = $2",
      [ids.designer, terrace?.id],
    );
    expect(notices.rows).toHaveLength(1);
  });

  it('never lets someone decide a scope change they proposed', async () => {
    const tasks = await tasksByTitle();
    const planning = tasks.get('Prepare space planning options');
    const proposed = await as.admin
      .post(`/v1/projects/${projectId}/scope-changes`, {
        taskShifts: [],
        newTasks: [],
        cancelTaskIds: [planning?.id],
        title: 'Drop space planning',
        description: 'The client brought their own layout.',
      })
      .expect(201);
    const decision = await as.admin
      .post(`/v1/scope-changes/${proposed.body.id}/decision`, {
        decision: 'approved',
        note: 'Approving my own change',
        version: proposed.body.version,
      })
      .expect(403);
    expect(decision.body.message).toContain('Someone else');
    await as.outsider.get(`/v1/projects/${projectId}/scope-changes`).expect(404);
    expect((await tasksByTitle()).get('Prepare space planning options')?.status).not.toBe(
      'cancelled',
    );
  });

  it('stops the running timer and audits a started task it cancels', async () => {
    const brief = (await tasksByTitle()).get('Capture the client brief');
    await as.designer.post(`/v1/tasks/${brief?.id}/work/start`).expect(200);
    const proposed = await as.pm
      .post(`/v1/projects/${projectId}/scope-changes`, {
        taskShifts: [],
        newTasks: [],
        cancelTaskIds: [brief?.id],
        title: 'The client wrote their own brief',
        description: 'They sent a full written brief, so the capture session is not needed.',
      })
      .expect(201);
    const decided = await as.admin
      .post(`/v1/scope-changes/${proposed.body.id}/decision`, {
        decision: 'approved',
        note: 'Agreed',
        version: proposed.body.version,
      })
      .expect(200);
    expect(decided.body.cancellations[0]).toMatchObject({ outcome: 'cancelled' });
    const { pool } = testApp.database;
    const running = await pool.query(
      'SELECT id FROM work_sessions WHERE task_id = $1 AND ended_at IS NULL',
      [brief?.id],
    );
    expect(running.rows).toHaveLength(0);
    const audited = await pool.query(
      "SELECT after FROM audit_log WHERE action = 'task.cancelled' AND entity_id = $1",
      [brief?.id],
    );
    expect(audited.rows[0]?.after).toMatchObject({ scopeChangeId: proposed.body.id });
  });
});
