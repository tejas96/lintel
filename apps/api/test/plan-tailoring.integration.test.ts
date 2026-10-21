import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, nextMonday, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

/**
 * Tailoring a template before the project starts: the live preview and the
 * created project come from the same plan builder, and only people who may
 * create projects can use either.
 */
let testApp: TestApp;
type Client = ReturnType<typeof client>;
const as: Record<'owner' | 'pm' | 'designer', Client> = {} as never;
const ids = { pm: '', designer: '', site: '', lead: '' };
let versionId = '';

function planBody(tailoring: object) {
  return {
    managerUserId: ids.pm,
    plannedStartDate: nextMonday(),
    templateVersionId: versionId,
    templateOptions: [],
    members: [
      { userId: ids.designer, projectRole: 'designer' },
      { userId: ids.site, projectRole: 'site_supervisor' },
    ],
    tailoring,
  };
}

const tailoring = {
  removedTaskKeys: ['mood-board'],
  addedStages: [{ key: 'added-terrace', name: 'Terrace garden', afterStageKey: 'discovery' }],
  addedTasks: [
    {
      key: 'added-planting',
      stageKey: 'added-terrace',
      title: 'Plan the terrace planting',
      durationDays: 2,
      dependsOn: ['site-measurement'],
      priority: 'high',
      responsibleRole: 'designer',
    },
  ],
  adjustments: [
    { taskKey: 'client-brief', durationDays: 4 },
    { taskKey: 'site-measurement', ownerUserId: '' },
  ],
};

beforeAll(async () => {
  testApp = await createTestApp();
  as.owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
  as.pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
  as.designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
  ids.pm = await userIdOf(testApp, PEOPLE.projectManager);
  ids.designer = await userIdOf(testApp, PEOPLE.employee);
  ids.site = await userIdOf(testApp, PEOPLE.siteSupervisor);
  ids.lead = await userIdOf(testApp, PEOPLE.teamLead);
  // The lead is not on the team: choosing them for one task adds them as a member.
  tailoring.adjustments[1] = { taskKey: 'site-measurement', ownerUserId: ids.lead };
  const templates = await as.owner
    .get('/v1/templates?projectType=residential_interior')
    .expect(200);
  versionId = templates.body.find((item: { publishedVersion: unknown }) => item.publishedVersion)
    .publishedVersion.id;
});

afterAll(async () => {
  await testApp.close();
});

describe('tailoring a plan before the project starts', () => {
  it('previews the tailored plan with its dates, people and end date', async () => {
    const plain = await as.pm.post('/v1/projects/plan-preview', planBody({})).expect(200);
    const preview = await as.pm.post('/v1/projects/plan-preview', planBody(tailoring)).expect(200);
    const keys = preview.body.tasks.map((task: { key: string }) => task.key);
    expect(keys).not.toContain('mood-board');
    expect(preview.body.stages[1]).toMatchObject({ key: 'added-terrace', isAdded: true });
    const planting = preview.body.tasks.find(
      (task: { key: string }) => task.key === 'added-planting',
    );
    expect(planting).toMatchObject({ isAdded: true, durationDays: 2, ownerUserId: ids.designer });
    const measure = preview.body.tasks.find(
      (task: { key: string }) => task.key === 'site-measurement',
    );
    expect(measure.ownerUserId).toBe(ids.lead);
    const brief = preview.body.tasks.find((task: { key: string }) => task.key === 'client-brief');
    expect(brief.durationDays).toBe(4);
    expect(preview.body.workingDays).toBeGreaterThan(0);
    expect(typeof plain.body.plannedEndDate).toBe('string');
  });

  it('creates exactly the previewed plan and records the tailoring', async () => {
    const preview = await as.pm.post('/v1/projects/plan-preview', planBody(tailoring)).expect(200);
    const created = await as.pm
      .post('/v1/projects', {
        ...planBody(tailoring),
        name: 'Terrace flat',
        clientName: 'Rao family',
        clientPhone: null,
        clientEmail: null,
        siteAddress: null,
        projectType: 'residential_interior',
        description: null,
        criticality: 'normal',
        budgetMinor: null,
      })
      .expect(201);
    expect(created.body.plannedEndDate).toBe(preview.body.plannedEndDate);
    expect(created.body.stages.map((stage: { name: string }) => stage.name)).toContain(
      'Terrace garden',
    );
    const members = created.body.members.map((member: { user: { id: string } }) => member.user.id);
    expect(members).toContain(ids.lead);
    const tasks = await as.pm
      .get(`/v1/tasks?projectId=${created.body.id}&status=all&pageSize=100`)
      .expect(200);
    const titles = tasks.body.items.map((task: { title: string }) => task.title);
    expect(titles).toContain('Plan the terrace planting');
    expect(titles).not.toContain('Build the mood board');
    const activity = await as.pm.get(`/v1/projects/${created.body.id}/activity`).expect(200);
    const summaries = activity.body.items.map((item: { summary: string }) => item.summary);
    expect(summaries.some((summary: string) => summary.includes('Tailored before the start'))).toBe(
      true,
    );
  });

  it('names each problem with the field it concerns', async () => {
    const invalid = await as.pm
      .post(
        '/v1/projects/plan-preview',
        planBody({ removedTaskKeys: ['no-such-task'], adjustments: [] }),
      )
      .expect(400);
    expect(invalid.body.details).toEqual([
      { field: 'tailoring.removedTaskKeys.0', message: 'This task is not in the template.' },
    ]);
    const early = await as.pm
      .post(
        '/v1/projects/plan-preview',
        planBody({ adjustments: [{ taskKey: 'client-brief', startDate: '2020-01-06' }] }),
      )
      .expect(400);
    expect(early.body.details[0].field).toBe('tailoring.adjustments.0.startDate');
  });

  it('is only for people who may create projects', async () => {
    await as.designer.post('/v1/projects/plan-preview', planBody({})).expect(403);
  });
});
