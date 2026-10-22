import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, userIdOf } from './support/journey-helpers';
import {
  createProjectOn,
  type Definition,
  publishNextVersion,
  publishTemplateCopy,
} from './support/template-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

let testApp: TestApp;
type Client = ReturnType<typeof client>;
const as: Record<'owner' | 'pm' | 'designer' | 'outsider', Client> = {} as never;
let projectId: string;
let targetVersionId: string;

interface TaskRow {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly priority: string;
  readonly plannedStartDate: string;
  readonly dueDate: string;
  readonly version: number;
}

async function tasksByTitle(): Promise<Map<string, TaskRow>> {
  const tasks = await as.pm
    .get(`/v1/tasks?projectId=${projectId}&status=all&pageSize=100`)
    .expect(200);
  return new Map(tasks.body.items.map((task: TaskRow) => [task.title, task]));
}

/** Version 2: renames, a priority change, a longer task, one removal, new work and a new stage. */
function secondVersion(definition: Definition): Definition {
  const next: Definition = structuredClone(definition);
  const task = (key: string) =>
    next.stages.flatMap((stage) => stage.tasks).find((candidate) => candidate.key === key);
  const moodBoard = task('mood-board');
  const brief = task('client-brief');
  const spacePlanning = task('space-planning');
  if (!moodBoard || !brief || !spacePlanning) throw new Error('Unexpected template shape');
  moodBoard.title = 'Build the mood board and palette';
  brief.priority = 'low';
  spacePlanning.durationDays += 2;
  for (const stage of next.stages) {
    stage.tasks = stage.tasks.filter((candidate) => candidate.key !== 'site-survey-review');
    for (const candidate of stage.tasks) {
      candidate.dependsOn = candidate.dependsOn.filter((key) => key !== 'site-survey-review');
    }
  }
  const development = next.stages.find((stage) => stage.key === 'design-development');
  development?.tasks.push({
    key: 'lighting-plan',
    title: 'Prepare the lighting plan',
    responsibleRole: 'designer',
    durationDays: 2,
    dependsOn: ['working-drawings'],
    priority: 'high',
    requiresReview: false,
    checklist: [{ label: 'Mark every switch', required: true }],
    deliverables: [],
  });
  development?.tasks.push({
    key: 'material-samples',
    title: 'Get client approval on material samples',
    responsibleRole: 'designer',
    durationDays: 2,
    dependsOn: [],
    priority: 'medium',
    requiresReview: false,
    checklist: [],
    deliverables: [],
  });
  const handover = next.stages.findIndex((stage) => stage.key === 'design-handover');
  next.stages.splice(handover + 1, 0, {
    key: 'client-signoff',
    name: 'Client sign-off',
    milestones: [{ key: 'signed', name: 'Design signed off', requiresClientApproval: true }],
    tasks: [
      {
        key: 'signoff-meeting',
        title: 'Hold the sign-off meeting',
        milestoneKey: 'signed',
        responsibleRole: 'manager',
        durationDays: 1,
        dependsOn: ['construction-drawings'],
        priority: 'high',
        requiresReview: false,
        checklist: [],
        deliverables: [],
      },
    ],
  });
  return next;
}

beforeAll(async () => {
  testApp = await createTestApp();
  as.owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
  as.pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
  as.designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
  as.outsider = client(testApp, await signInAs(testApp, '9000000008'));
  const template = await publishTemplateCopy(as.owner, `Update test ${Date.now()}`);
  projectId = await createProjectOn(as.owner, template.versionId, {
    pm: await userIdOf(testApp, PEOPLE.projectManager),
    designer: await userIdOf(testApp, PEOPLE.employee),
    lead: await userIdOf(testApp, PEOPLE.teamLead),
    site: await userIdOf(testApp, PEOPLE.siteSupervisor),
  });
  const brief = (await tasksByTitle()).get('Capture the client brief');
  await as.designer.post(`/v1/tasks/${brief?.id}/work/start`).expect(200);
  targetVersionId = await publishNextVersion(
    as.owner,
    template.templateId,
    secondVersion(template.definition),
  );
});

afterAll(async () => {
  await testApp.close();
});

describe('moving a project to a newer template version', () => {
  it('shows a dry run to managers only', async () => {
    const status = await as.designer.get(`/v1/projects/${projectId}/template-update`).expect(200);
    expect(status.body).toMatchObject({
      available: { id: targetVersionId },
      viewerCanUpdate: false,
    });
    const body = { targetVersionId, ticked: [] };
    await as.outsider.post(`/v1/projects/${projectId}/template-update/preview`, body).expect(404);
    await as.designer.post(`/v1/projects/${projectId}/template-update/preview`, body).expect(403);
    const preview = await as.pm
      .post(`/v1/projects/${projectId}/template-update/preview`, body)
      .expect(200);
    const item = (key: string) =>
      preview.body.items.find((entry: { key: string }) => entry.key === key);
    expect(item('task:lighting-plan')).toMatchObject({ change: 'added', willApply: true });
    expect(item('stage:client-signoff')).toMatchObject({ change: 'added', willApply: true });
    expect(item('task:site-survey-review')).toMatchObject({ change: 'removed', willApply: true });
    expect(item('task:mood-board')).toMatchObject({ change: 'changed', willApply: true });
    expect(item('task:client-brief')).toMatchObject({
      willApply: false,
      optIn: expect.any(Object),
    });
    expect(item('task:space-planning').fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'duration', outcome: 'held' })]),
    );
    const before = await tasksByTitle();
    expect(before.get('Build the mood board')?.status).toBe('ready');
    // A new task that waits for nothing still sits inside its stage, never at "today".
    const conceptDue = before.get('Present the concept to the client')?.dueDate ?? '';
    const stageStart = before.get('Prepare working drawings')?.plannedStartDate;
    expect(item('task:material-samples').schedule.plannedStartDate).toBe(stageStart);
    expect(item('task:material-samples').schedule.plannedStartDate > conceptDue).toBe(true);
    expect(preview.body.forecastEndDate).toEqual(expect.any(String));
  });

  it('applies new and unstarted work, holds started work and committed dates unless ticked', async () => {
    const project = await as.pm.get(`/v1/projects/${projectId}`).expect(200);
    const before = await tasksByTitle();
    const body = {
      targetVersionId,
      ticked: ['task:space-planning'],
      extendPlannedEnd: true,
      version: project.body.version,
    };
    await as.pm
      .post(`/v1/projects/${projectId}/template-update`, {
        ...body,
        version: project.body.version + 5,
      })
      .expect(409);
    await as.designer.post(`/v1/projects/${projectId}/template-update`, body).expect(403);
    const applied = await as.pm.post(`/v1/projects/${projectId}/template-update`, body).expect(200);
    expect(applied.body).toMatchObject({ toVersionNumber: 2, added: 5, cancelled: 1 });

    const after = await tasksByTitle();
    expect(after.get('Build the mood board and palette')?.status).toBe('ready');
    expect(after.get('Capture the client brief')?.priority).toBe(
      before.get('Capture the client brief')?.priority,
    );
    expect(after.get('Capture the client brief')?.status).toBe('in_progress');
    expect(after.get('Review the site survey')?.status).toBe('cancelled');
    expect(after.get('Prepare the lighting plan')?.status).toBe('ready');
    expect(after.get('Hold the sign-off meeting')).toBeDefined();
    const samples = after.get('Get client approval on material samples');
    expect(samples?.plannedStartDate).toBe(before.get('Prepare working drawings')?.plannedStartDate);
    const lighting = await as.pm
      .get(`/v1/tasks/${after.get('Prepare the lighting plan')?.id}`)
      .expect(200);
    expect(lighting.body.prerequisites.map((task: { title: string }) => task.title)).toEqual([
      'Prepare working drawings',
    ]);
    const planning = after.get('Prepare space planning options');
    const plannedBefore = before.get('Prepare space planning options')?.dueDate ?? '';
    expect((planning?.dueDate ?? '') > plannedBefore).toBe(true);
    const history = await as.pm.get(`/v1/tasks/${planning?.id}`).expect(200);
    expect(history.body.scheduleChanges[0].reason).toContain('Template updated');

    const updated = await as.pm.get(`/v1/projects/${projectId}`).expect(200);
    expect(updated.body.template.versionNumber).toBe(2);
    const stages = updated.body.stages.map((stage: { name: string }) => stage.name);
    expect(stages.indexOf('Client sign-off')).toBe(stages.indexOf('Design handover') + 1);
    const status = await as.pm.get(`/v1/projects/${projectId}/template-update`).expect(200);
    expect(status.body.available).toBeNull();
    expect(status.body.history[0]).toMatchObject({ fromVersionNumber: 1, toVersionNumber: 2 });
    const activity = await as.pm.get(`/v1/projects/${projectId}/activity`).expect(200);
    expect(
      activity.body.items.some(
        (item: { type: string }) => item.type === 'project.template_updated',
      ),
    ).toBe(true);
    await as.pm.post(`/v1/projects/${projectId}/template-update`, body).expect(422);
  });
});
