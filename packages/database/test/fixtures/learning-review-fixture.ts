import { randomUUID } from 'node:crypto';
import type { Database } from '../../src/client';
import * as t from '../../src/schema';

const at = (iso: string) => new Date(iso);

export interface ReviewFixtureInput {
  readonly people: { readonly designer: string; readonly pm: string };
  readonly projectId: string;
  /** Gets a deliverable reviewed three times (sent back twice). */
  readonly reviewedTaskId: string;
  /** Gets a deliverable still waiting for review. */
  readonly waitingTaskId: string;
  /** Gets two client blockers (one resolved after 72 h, one open) and a supplier blocker. */
  readonly blockedTaskId: string;
}

/**
 * Test-only: deliverable reviews and task blockers for the rework and delay
 * reports, in the first two weeks of May 2023. Returns the file the versions
 * point at, for clean-up.
 */
export async function seedReviewsAndClientWaits(
  db: Database,
  input: ReviewFixtureInput,
): Promise<string> {
  const [file] = await db
    .insert(t.files)
    .values({
      storageKey: `fixture/${randomUUID()}.pdf`,
      originalName: 'fixture.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1,
      checksumSha256: '0'.repeat(64),
      projectId: input.projectId,
      uploadedByUserId: input.people.designer,
    })
    .returning();
  if (!file) throw new Error('fixture file');
  const [onTask, withoutTask, waiting] = await db
    .insert(t.deliverables)
    .values([
      {
        projectId: input.projectId,
        taskId: input.reviewedTaskId,
        name: 'Concept drawings',
        status: 'approved',
        currentVersionNumber: 3,
      },
      {
        projectId: input.projectId,
        name: 'Site photographs',
        status: 'approved',
        currentVersionNumber: 1,
      },
      {
        projectId: input.projectId,
        taskId: input.waitingTaskId,
        name: 'Elevations',
        status: 'in_review',
        currentVersionNumber: 1,
      },
    ])
    .returning();
  if (!onTask || !withoutTask || !waiting) throw new Error('fixture deliverables');
  const version = (
    deliverableId: string,
    versionNumber: number,
    submitted: string,
    decision: 'approved' | 'changes_requested' | 'rejected' | 'pending',
    reviewed: string | null,
  ) => ({
    deliverableId,
    versionNumber,
    fileId: file.id,
    submittedByUserId: input.people.designer,
    submittedAt: at(submitted),
    decision,
    reviewedByUserId: reviewed ? input.people.pm : null,
    reviewedAt: reviewed ? at(reviewed) : null,
  });
  await db.insert(t.deliverableVersions).values([
    // Three reviews of 24 h each: sent back twice, then approved.
    version(onTask.id, 1, '2023-05-01T04:30:00Z', 'changes_requested', '2023-05-02T04:30:00Z'),
    version(onTask.id, 2, '2023-05-02T06:00:00Z', 'rejected', '2023-05-03T06:00:00Z'),
    version(onTask.id, 3, '2023-05-03T06:00:00Z', 'approved', '2023-05-04T06:00:00Z'),
    // 72 h, delayed; no task, second week.
    version(withoutTask.id, 1, '2023-05-06T00:00:00Z', 'approved', '2023-05-09T00:00:00Z'),
    // Still waiting for review.
    version(waiting.id, 1, '2023-05-12T00:00:00Z', 'pending', null),
  ]);
  const blocked = input.blockedTaskId;
  await db.insert(t.taskBlockers).values([
    // 72 h on the client, delayed.
    {
      taskId: blocked,
      category: 'client',
      reason: 'Fixture',
      raisedByUserId: input.people.pm,
      raisedAt: at('2023-05-01T00:00:00Z'),
      resolvedAt: at('2023-05-04T00:00:00Z'),
    },
    // Still waiting on the client.
    {
      taskId: blocked,
      category: 'client',
      reason: 'Fixture',
      raisedByUserId: input.people.pm,
      raisedAt: at('2023-05-10T00:00:00Z'),
    },
    // Not a client wait.
    {
      taskId: blocked,
      category: 'supplier',
      reason: 'Fixture',
      raisedByUserId: input.people.pm,
      raisedAt: at('2023-05-01T00:00:00Z'),
      resolvedAt: at('2023-05-09T00:00:00Z'),
    },
  ]);
  return file.id;
}
