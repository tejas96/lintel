import type { DatabaseExecutor } from '../client';
import {
  deliverables,
  deliverableVersions,
  files,
  priorityConflicts,
  scopeChangeRequests,
  scopeChangeTaskImpacts,
} from '../schema';
import type { FixtureProjects } from './operations-fixture';

const at = (value: string) => new Date(`${value}+05:30`);

/** A deliverable in review, a proposed scope change and an open priority conflict. */
export async function seedReviewsAndDecisions(
  db: DatabaseExecutor,
  p: (key: string) => string,
  fixture: FixtureProjects,
  [joineryTask, tileTask, facadeTask]: string[],
): Promise<void> {
  const [file] = await db
    .insert(files)
    .values({
      storageKey: 'fixtures/saska/concept-v1.pdf',
      originalName: 'concept-v1.pdf',
      contentType: 'application/pdf',
      sizeBytes: 482_113,
      checksumSha256: 'f'.repeat(64),
      projectId: fixture.saska,
      uploadedByUserId: p('designer1'),
    })
    .returning({ id: files.id });
  const [deliverable] = await db
    .insert(deliverables)
    .values({
      projectId: fixture.saska,
      name: 'Concept presentation',
      status: 'in_review',
      reviewerUserId: p('pm1'),
      currentVersionNumber: 1,
    })
    .returning({ id: deliverables.id });
  if (!file || !deliverable) throw new Error('Fixture deliverable was not created.');
  await db.insert(deliverableVersions).values({
    deliverableId: deliverable.id,
    versionNumber: 1,
    fileId: file.id,
    submittedByUserId: p('designer1'),
    submittedAt: at('2026-10-16T17:00:00'),
  });
  const [change] = await db
    .insert(scopeChangeRequests)
    .values({
      projectId: fixture.saska,
      title: 'Add a home office',
      description: 'Convert the guest bedroom into a home office with built-in storage.',
      requestedByUserId: p('pm1'),
    })
    .returning({ id: scopeChangeRequests.id });
  if (!change || !joineryTask || !tileTask || !facadeTask) throw new Error('Fixture IDs missing.');
  await db.insert(scopeChangeTaskImpacts).values({
    scopeChangeId: change.id,
    taskId: joineryTask,
    currentDueDate: '2026-11-03',
    proposedDueDate: '2026-11-06',
    shiftWorkingDays: 3,
  });
  await db.insert(priorityConflicts).values({
    raisedByUserId: p('designer2'),
    taskIds: [tileTask, facadeTask],
    note: 'The tile schedule and the facade board are both due this week; I cannot finish both.',
  });
}
