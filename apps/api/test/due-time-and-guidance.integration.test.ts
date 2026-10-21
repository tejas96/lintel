import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createJourneyProject, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

/**
 * An optional due time on tasks (a committed one moves like a due date: the
 * manager, a reason and history), and first-run tips stored per person.
 */
let testApp: TestApp;
type Client = ReturnType<typeof client>;
const as: Record<'owner' | 'pm' | 'designer' | 'site', Client> = {} as never;
let projectId = '';

beforeAll(async () => {
  testApp = await createTestApp();
  as.owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
  as.pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
  as.designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
  as.site = client(testApp, await signInAs(testApp, PEOPLE.siteSupervisor));
  projectId = await createJourneyProject(as.owner, {
    pm: await userIdOf(testApp, PEOPLE.projectManager),
    designer: await userIdOf(testApp, PEOPLE.employee),
    lead: await userIdOf(testApp, PEOPLE.teamLead),
    site: await userIdOf(testApp, PEOPLE.siteSupervisor),
  });
});

afterAll(async () => {
  for (const person of Object.values(as)) await person.post('/v1/me/guidance/reset', {});
  await testApp.close();
});

describe('an optional due time on tasks', () => {
  it('creates a task due at a time and shows it in lists', async () => {
    const designer = await userIdOf(testApp, PEOPLE.employee);
    const created = await as.pm
      .post('/v1/tasks', {
        projectId,
        stageId: null,
        milestoneId: null,
        parentTaskId: null,
        title: 'Call the stone supplier',
        description: null,
        priority: 'medium',
        ownerUserId: designer,
        reviewerUserId: null,
        collaboratorUserIds: [],
        plannedStartDate: null,
        dueDate: '2026-12-01',
        dueTime: '11:00',
        estimateMinutes: 30,
        requiresReview: false,
        completionCriteria: null,
        checklist: [],
        publish: true,
      })
      .expect(201);
    expect(created.body).toMatchObject({ status: 'ready', dueTime: '11:00' });
    const list = await as.designer.get(`/v1/tasks?projectId=${projectId}&pageSize=100`).expect(200);
    const row = list.body.items.find((task: { id: string }) => task.id === created.body.id);
    expect(row.dueTime).toBe('11:00');
  });

  it('refuses a malformed time', async () => {
    const tasks = await as.pm.get(`/v1/tasks?projectId=${projectId}&pageSize=100`).expect(200);
    const task = tasks.body.items[0];
    await as.pm
      .patch(`/v1/tasks/${task.id}`, { version: task.version, dueTime: '9:5' })
      .expect(400);
  });

  it('moves a committed due time only with the manager and a reason, and keeps it', async () => {
    const tasks = await as.pm.get(`/v1/tasks?projectId=${projectId}&pageSize=100`).expect(200);
    const task = tasks.body.items.find(
      (item: { title: string }) => item.title === 'Measure the site',
    );
    await as.site
      .patch(`/v1/tasks/${task.id}`, { version: task.version, dueTime: '15:00' })
      .expect(403);
    await as.pm
      .patch(`/v1/tasks/${task.id}`, { version: task.version, dueTime: '15:00' })
      .expect(400);
    const moved = await as.pm
      .patch(`/v1/tasks/${task.id}`, {
        version: task.version,
        dueTime: '15:00',
        scheduleChangeReason: 'Site opens after lunch',
      })
      .expect(200);
    expect(moved.body.dueTime).toBe('15:00');
    expect(moved.body.scheduleChanges.at(-1)).toMatchObject({
      previousDueTime: null,
      newDueTime: '15:00',
      reason: 'Site opens after lunch',
    });
  });
});

describe('first-run tips', () => {
  it('speaks to each role and remembers what each person has seen', async () => {
    const designer = await as.designer.get('/v1/me/guidance').expect(200);
    expect(designer.body.audience).toBe('member');
    expect(designer.body.tips.map((tip: { key: string }) => tip.key)).toEqual([
      'today',
      'task',
      'control_room',
      'leave',
    ]);
    const owner = await as.owner.get('/v1/me/guidance').expect(200);
    expect(owner.body.audience).toBe('owner');
    expect(owner.body.tips.map((tip: { key: string }) => tip.key)).toContain('command_center');
    const seen = await as.designer.post('/v1/me/guidance/today/seen', {}).expect(200);
    expect(seen.body.tips.find((tip: { key: string }) => tip.key === 'today').seen).toBe(true);
    // Seeing it twice is harmless, and other people are unaffected.
    await as.designer.post('/v1/me/guidance/today/seen', {}).expect(200);
    const pm = await as.pm.get('/v1/me/guidance').expect(200);
    expect(pm.body.tips.find((tip: { key: string }) => tip.key === 'today').seen).toBe(false);
    await as.designer.post('/v1/me/guidance/settings/seen', {}).expect(400);
    const reset = await as.designer.post('/v1/me/guidance/reset', {}).expect(200);
    expect(reset.body.tips.every((tip: { seen: boolean }) => !tip.seen)).toBe(true);
  });
});
