import { describe, expect, it } from 'vitest';
import { contextFor, InMemoryOperationsWorld } from '../testing/in-memory-operations.world';
import { DeliverableCommands } from './deliverable.commands';
import { DeliverableViewerQuery } from './deliverable-access';
import { ReviewDeliverableCommand } from './review-deliverable.command';

function setup() {
  const world = new InMemoryOperationsWorld();
  world.addProject('p1', 'pm', { ananya: 'designer', tara: 'reviewer', rohit: 'designer' });
  world.addTask({ id: 'moodboard', projectId: 'p1', ownerUserId: 'ananya', status: 'in_progress' });
  world.deliverables.push({
    id: 'd1',
    projectId: 'p1',
    taskId: 'moodboard',
    name: 'Moodboard PDF',
    isRequired: true,
    status: 'not_submitted',
    reviewerUserId: 'tara',
    currentVersionNumber: 0,
    version: 1,
  });
  for (const [id, uploader] of [
    ['f1', 'ananya'],
    ['f2', 'ananya'],
    ['f-rohit', 'rohit'],
  ] as const) {
    world.files.push({
      id,
      storageKey: `uploads/${id}.pdf`,
      originalName: `${id}.pdf`,
      contentType: 'application/pdf',
      sizeBytes: 1000,
      projectId: null,
      visibility: 'private',
      status: 'available',
      uploadedByUserId: uploader,
    });
  }
  const deps = world.dependencies();
  return {
    world,
    deliverables: new DeliverableCommands(deps),
    review: new ReviewDeliverableCommand(deps),
    viewer: new DeliverableViewerQuery(deps.uow.stores),
  };
}

describe('deliverable review flow', () => {
  it('submits a version for review and notifies the assigned reviewer', async () => {
    const { world, deliverables } = setup();
    const after = await deliverables.submitVersion(contextFor('ananya'), 'd1', {
      fileId: 'f1',
      note: 'First pass',
      version: 1,
    });
    expect(after).toMatchObject({ status: 'in_review', currentVersionNumber: 1, version: 2 });
    expect(world.files.find((file) => file.id === 'f1')).toMatchObject({
      projectId: 'p1',
      visibility: 'project',
    });
    expect(world.notifications.map((n) => [n.recipientUserId, n.kind])).toEqual([
      ['tara', 'review_requested'],
    ]);
    expect(world.events.map((event) => event.type)).toEqual(['DeliverableSubmitted']);
  });

  it('refuses outsiders, stale versions, foreign files and double submission', async () => {
    const { deliverables } = setup();
    const submit = (who: string, fileId: string, version: number) =>
      deliverables.submitVersion(contextFor(who), 'd1', { fileId, note: null, version });
    await expect(submit('rohit', 'f-rohit', 1)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(submit('ananya', 'f-rohit', 1)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    await expect(submit('ananya', 'f1', 7)).rejects.toMatchObject({ code: 'STALE_VERSION' });
    await submit('ananya', 'f1', 1);
    await expect(submit('ananya', 'f2', 2)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
  });

  it('never allows self-review and needs a reason for anything but approval', async () => {
    const { world, deliverables, review, viewer } = setup();
    await deliverables.submitVersion(contextFor('pm', 'project_manager'), 'd1', {
      fileId: await pmFile(world),
      note: null,
      version: 1,
    });
    const versionId = world.versions[0]?.id ?? '';
    const pmView = await viewer.execute(contextFor('pm', 'project_manager').actor, 'd1');
    expect(pmView.viewerCanReview).toBe(false);
    await expect(
      review.execute(contextFor('pm', 'project_manager'), versionId, {
        decision: 'approved',
        comment: null,
        version: 2,
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'You cannot review your own submission.',
    });
    await expect(
      review.execute(contextFor('tara', 'team_lead'), versionId, {
        decision: 'changes_requested',
        comment: null,
        version: 2,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      review.execute(contextFor('rohit'), versionId, {
        decision: 'approved',
        comment: null,
        version: 2,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('approving a deliverable notifies the submitter and leaves the task alone', async () => {
    const { world, deliverables, review, viewer } = setup();
    await deliverables.submitVersion(contextFor('ananya'), 'd1', {
      fileId: 'f1',
      note: null,
      version: 1,
    });
    const versionId = world.versions[0]?.id ?? '';
    const tara = contextFor('tara', 'team_lead');
    expect((await viewer.execute(tara.actor, 'd1')).viewerCanReview).toBe(true);
    const decided = await review.execute(tara, versionId, {
      decision: 'approved',
      comment: null,
      version: 2,
    });
    expect(decided).toMatchObject({ status: 'approved', version: 3 });
    expect(world.versions[0]?.decision).toBe('approved');
    expect(world.tasks.get('moodboard')).toMatchObject({ status: 'in_progress', version: 1 });
    expect(world.notifications.at(-1)).toMatchObject({
      recipientUserId: 'ananya',
      kind: 'review_decided',
    });
    expect(world.events.map((event) => event.type)).toEqual([
      'DeliverableSubmitted',
      'DeliverableReviewed',
    ]);
    await expect(
      review.execute(tara, versionId, { decision: 'rejected', comment: 'Too late', version: 3 }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
});

async function pmFile(world: InMemoryOperationsWorld): Promise<string> {
  world.files.push({
    id: 'f-pm',
    storageKey: 'uploads/f-pm.pdf',
    originalName: 'pm.pdf',
    contentType: 'application/pdf',
    sizeBytes: 10,
    projectId: 'p1',
    visibility: 'project',
    status: 'available',
    uploadedByUserId: 'pm',
  });
  return 'f-pm';
}
