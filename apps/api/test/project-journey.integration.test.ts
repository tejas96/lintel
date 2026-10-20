import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, nextMonday, TINY_PNG, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

/**
 * The core Phase 1 journey through the real HTTP API: owner creates a project
 * from a template → manager assigns → employee acknowledges, starts, gets
 * blocked → manager unblocks → deliverable is reviewed, revised and approved →
 * task done → milestone closed → an outsider cannot see any of it.
 */
let testApp: TestApp;
const ids: Record<string, string> = {};

beforeAll(async () => {
  testApp = await createTestApp();
  ids.pm = await userIdOf(testApp, PEOPLE.projectManager);
  ids.designer = await userIdOf(testApp, PEOPLE.employee);
  ids.otherDesigner = await userIdOf(testApp, '9000000007');
  ids.lead = await userIdOf(testApp, PEOPLE.teamLead);
  ids.site = await userIdOf(testApp, PEOPLE.siteSupervisor);
});

afterAll(async () => {
  await testApp.close();
});

describe('project lifecycle journey', () => {
  it('runs from template to approved deliverable and closed milestone', async () => {
    const owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
    const pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
    const designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
    const outsider = client(testApp, await signInAs(testApp, '9000000008'));

    // 1–2. The owner creates a project from the published residential template.
    const templates = await owner.get('/v1/templates?projectType=residential_interior').expect(200);
    const template = templates.body.find(
      (item: { publishedVersion: unknown }) => item.publishedVersion,
    );
    const created = await owner
      .post('/v1/projects', {
        name: `Journey Residence ${Date.now()}`,
        clientName: 'Journey Family',
        clientPhone: null,
        clientEmail: null,
        siteAddress: 'Plot 7, Test Lane',
        projectType: 'residential_interior',
        description: null,
        criticality: 'normal',
        managerUserId: ids.pm,
        plannedStartDate: nextMonday(),
        templateVersionId: template.publishedVersion.id,
        templateOptions: [],
        members: [
          { userId: ids.designer, projectRole: 'designer' },
          { userId: ids.lead, projectRole: 'reviewer' },
          { userId: ids.site, projectRole: 'site_supervisor' },
        ],
        budgetMinor: 250_000_00,
      })
      .expect(201);
    const projectId: string = created.body.id;
    expect(created.body.stages.length).toBeGreaterThanOrEqual(4);
    expect(created.body.stages[0].status).toBe('active');

    const tasks = await pm.get(`/v1/tasks?projectId=${projectId}&pageSize=100`).expect(200);
    const byTitle = (title: string) =>
      tasks.body.items.find((task: { title: string }) => task.title === title);
    const brief = byTitle('Capture the client brief');
    const moodBoard = byTitle('Build the mood board');
    const surveyReview = byTitle('Review the site survey');
    expect(brief.owner.id).toBe(ids.designer);

    // 3. The manager assigns the mood board to another designer (added to the team).
    const assigned = await pm
      .post(`/v1/tasks/${moodBoard.id}/assign`, {
        ownerUserId: ids.otherDesigner,
        reason: 'Balance load',
        version: moodBoard.version,
      })
      .expect(200);
    expect(assigned.body.owner.id).toBe(ids.otherDesigner);

    // 4. The designer sees the brief in their queue and acknowledges it.
    const queue = await designer.get('/v1/me/work-queue').expect(200);
    expect(
      queue.body.items.some((item: { task: { id: string } }) => item.task.id === brief.id),
    ).toBe(true);
    await designer.post(`/v1/tasks/${brief.id}/acknowledge`).expect(200);

    // 5. They start work and report a client blocker.
    const started = await designer.post(`/v1/tasks/${brief.id}/work/start`).expect(200);
    expect(started.body.status).toBe('in_progress');
    const blocked = await designer
      .post(`/v1/tasks/${brief.id}/blockers`, {
        category: 'client',
        reason: 'Waiting for the client to share the floor plan',
        waitingOnUserId: null,
        version: started.body.version,
      })
      .expect(200);
    expect(blocked.body.status).toBe('blocked');

    // 6. The manager resolves the blocker and work resumes.
    const blocker = blocked.body.blockers.find(
      (item: { resolvedAt: string | null }) => item.resolvedAt === null,
    );
    const resumed = await pm
      .post(`/v1/blockers/${blocker.id}/resolve`, {
        resolution: 'The client shared the plan',
        resumeWork: true,
      })
      .expect(200);
    expect(resumed.body.status).toBe('in_progress');

    // 7–10. Deliverable: submit, changes requested, resubmit, approved.
    const deliverables = await designer.get(`/v1/projects/${projectId}/deliverables`).expect(200);
    const briefDeliverable = deliverables.body.find(
      (item: { task: { id: string } | null }) => item.task?.id === brief.id,
    );
    const firstFile = await designer
      .upload('/v1/files', TINY_PNG, 'brief-v1.png', { projectId })
      .expect(201);
    const submitted = await designer
      .post(`/v1/deliverables/${briefDeliverable.id}/versions`, {
        fileId: firstFile.body.id,
        note: 'First draft',
        version: briefDeliverable.version,
      })
      .expect(201);
    expect(submitted.body.status).toBe('in_review');
    const selfReview = await designer.post(
      `/v1/deliverable-versions/${submitted.body.latestVersion.id}/review`,
      {
        decision: 'approved',
        comment: null,
        version: submitted.body.version,
      },
    );
    expect([403, 422]).toContain(selfReview.status);
    const changes = await pm
      .post(`/v1/deliverable-versions/${submitted.body.latestVersion.id}/review`, {
        decision: 'changes_requested',
        comment: 'Add the budget table',
        version: submitted.body.version,
      })
      .expect(200);
    expect(changes.body.status).toBe('changes_requested');
    const secondFile = await designer
      .upload('/v1/files', TINY_PNG, 'brief-v2.png', { projectId })
      .expect(201);
    const resubmitted = await designer
      .post(`/v1/deliverables/${briefDeliverable.id}/versions`, {
        fileId: secondFile.body.id,
        note: 'Budget table added',
        version: changes.body.version,
      })
      .expect(201);
    expect(resubmitted.body.currentVersionNumber).toBe(2);
    const approved = await pm
      .post(`/v1/deliverable-versions/${resubmitted.body.latestVersion.id}/review`, {
        decision: 'approved',
        comment: null,
        version: resubmitted.body.version,
      })
      .expect(200);
    expect(approved.body.status).toBe('approved');
    expect(approved.body.versions).toHaveLength(2);
    const stillInProgress = await designer.get(`/v1/tasks/${brief.id}`).expect(200);
    expect(stillInProgress.body.status).toBe('in_progress');

    // 11. Finish the checklist, then complete the task.
    for (const item of stillInProgress.body.checklistItems) {
      await designer.post(`/v1/checklist-items/${item.id}/toggle`, { completed: true }).expect(200);
    }
    const ready = await designer.get(`/v1/tasks/${brief.id}`).expect(200);
    const done = await designer
      .post(`/v1/tasks/${brief.id}/transition`, {
        to: 'done',
        note: null,
        version: ready.body.version,
      })
      .expect(200);
    expect(done.body.status).toBe('done');

    // 12. The milestone closes only when every linked task is closed.
    const detail = await pm.get(`/v1/projects/${projectId}`).expect(200);
    const milestone = detail.body.milestones.find(
      (item: { name: string }) => item.name === 'Brief signed off',
    );
    const early = await pm.post(`/v1/milestones/${milestone.id}/complete`, {
      note: null,
      version: milestone.version,
    });
    expect(early.status).toBe(422);
    const survey = await pm.get(`/v1/tasks/${surveyReview.id}`).expect(200);
    await pm
      .post(`/v1/tasks/${surveyReview.id}/transition`, {
        to: 'cancelled',
        note: 'Survey reviewed on site with the client',
        version: survey.body.version,
      })
      .expect(200);
    const closed = await pm
      .post(`/v1/milestones/${milestone.id}/complete`, {
        note: 'Client signed the brief',
        version: milestone.version,
      })
      .expect(200);
    const closedMilestone = closed.body.milestones.find(
      (item: { id: string }) => item.id === milestone.id,
    );
    expect(closedMilestone.status).toBe('completed');

    // 16. Someone outside the project sees nothing — not even that it exists.
    await outsider.get(`/v1/projects/${projectId}`).expect(404);
    await outsider.get(`/v1/tasks/${brief.id}`).expect(404);
    await outsider.get(`/v1/files/${secondFile.body.id}/content`).expect(404);
    const budgetForDesigner = await designer.get(`/v1/projects/${projectId}`).expect(200);
    expect(budgetForDesigner.body.budgetMinor).toBeNull();
  });
});
