import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import { activityEvents, deliverables, deliverableVersions, files, tasks } from '../../schema';
import type { HistoryProject } from './demo-history-projects';
import { fileSlug, type PlannedVersion, planReviewHistory } from './demo-history-reviews.plan';
import { type HistoryClock, HOUR_MS } from './demo-history-time';

/** Deliverables still waiting for a reviewer, so the approvals queue is not empty. */
const WAITING_FOR_REVIEW = 2;

type DeliverableRow = Awaited<ReturnType<typeof loadDeliverables>>[number];

async function loadDeliverables(db: Database, projectIds: readonly string[]) {
  return db
    .select({
      id: deliverables.id,
      name: deliverables.name,
      projectId: deliverables.projectId,
      reviewerUserId: deliverables.reviewerUserId,
      taskId: tasks.id,
      number: tasks.number,
      status: tasks.status,
      ownerUserId: tasks.ownerUserId,
      taskReviewerUserId: tasks.reviewerUserId,
      requiresReview: tasks.requiresReview,
      startedAt: tasks.startedAt,
      submittedAt: tasks.submittedAt,
      completedAt: tasks.completedAt,
    })
    .from(deliverables)
    .innerJoin(tasks, eq(tasks.id, deliverables.taskId))
    .where(
      and(
        inArray(deliverables.projectId, [...projectIds]),
        eq(deliverables.status, 'not_submitted'),
        inArray(tasks.status, ['done', 'in_review']),
      ),
    )
    .orderBy(asc(tasks.number), asc(deliverables.createdAt));
}

/**
 * The assigned reviewer, else the task's reviewer or the project manager;
 * the studio owner reviews what the manager submitted. Never the submitter.
 */
function reviewerFor(
  row: DeliverableRow,
  managerUserId: string,
  submitter: string,
  studioOwnerId: string,
) {
  const candidates = [row.reviewerUserId, row.taskReviewerUserId, managerUserId, studioOwnerId];
  return candidates.find((id): id is string => id !== null && id !== submitter) ?? studioOwnerId;
}

/**
 * File metadata for a demo submission. Demo history files have no stored
 * bytes in object storage: they are PDFs (never previewed inline), so the
 * screens show the name and size, and downloading one answers "not found".
 */
async function insertFile(db: Database, row: DeliverableRow, number: number, by: string, at: Date) {
  const storageKey = `demo-history/${row.id}/v${number}.pdf`;
  const [file] = await db
    .insert(files)
    .values({
      storageKey,
      originalName: `${fileSlug(row.name)}-v${number}.pdf`,
      contentType: 'application/pdf',
      sizeBytes: 240_000 + ((row.number * 61 + number * 17) % 40) * 52_000,
      checksumSha256: createHash('sha256').update(storageKey).digest('hex'),
      projectId: row.projectId,
      visibility: 'project',
      status: 'available',
      uploadedByUserId: by,
      createdAt: at,
    })
    .returning({ id: files.id });
  if (!file) throw new Error('Could not store demo file metadata.');
  return file.id;
}

async function writeVersion(
  db: Database,
  row: DeliverableRow,
  people: { submitter: string; reviewer: string },
  number: number,
  planned: PlannedVersion | { submittedAt: Date; note: string | null; decision: 'pending' },
) {
  const fileId = await insertFile(db, row, number, people.submitter, planned.submittedAt);
  const decided = planned.decision !== 'pending' ? planned : null;
  const [version] = await db
    .insert(deliverableVersions)
    .values({
      deliverableId: row.id,
      versionNumber: number,
      fileId,
      note: planned.note,
      submittedByUserId: people.submitter,
      submittedAt: planned.submittedAt,
      decision: planned.decision,
      reviewedByUserId: decided ? people.reviewer : null,
      reviewedAt: decided?.reviewedAt ?? null,
      reviewComment: decided?.comment ?? null,
    })
    .returning({ id: deliverableVersions.id });
  if (!version) throw new Error('Could not store a demo deliverable version.');
  const base = { projectId: row.projectId, taskId: row.taskId };
  await db.insert(activityEvents).values({
    ...base,
    actorUserId: people.submitter,
    type: 'deliverable.version_submitted',
    summary: `Submitted version ${number} of “${row.name}” for review.`,
    payload: { deliverableId: row.id, versionId: version.id, versionNumber: number, fileId },
    createdAt: planned.submittedAt,
  });
  if (!decided) return;
  const verdict = decided.decision === 'approved' ? 'approved' : 'needs changes';
  await db.insert(activityEvents).values({
    ...base,
    actorUserId: people.reviewer,
    type: 'deliverable.reviewed',
    summary: `Version ${number} of “${row.name}” ${verdict}.`,
    payload: {
      deliverableId: row.id,
      versionId: version.id,
      decision: decided.decision,
      comment: decided.comment,
    },
    createdAt: decided.reviewedAt,
  });
}

type ReviewPeople = { submitter: string; reviewer: string };

/** Version 1 sent with the task's own submission, still waiting for a decision. */
async function submitForReview(
  db: Database,
  clock: HistoryClock,
  row: DeliverableRow,
  people: ReviewPeople,
) {
  const submittedAt = row.submittedAt ?? new Date(clock.now.getTime() - 3 * HOUR_MS);
  await writeVersion(db, row, people, 1, { submittedAt, note: null, decision: 'pending' });
  await db
    .update(deliverables)
    .set({
      status: 'in_review',
      currentVersionNumber: 1,
      version: sql`${deliverables.version} + 1`,
      updatedAt: submittedAt,
    })
    .where(eq(deliverables.id, row.id));
}

/** The full history of a finished task's deliverable; returns how many versions it took. */
async function approveWithHistory(
  db: Database,
  clock: HistoryClock,
  row: DeliverableRow & { completedAt: Date },
  people: ReviewPeople,
  choice: { key: string; mayRework: boolean },
): Promise<number> {
  const history = planReviewHistory(
    { ...choice, startedAt: row.startedAt, completedAt: row.completedAt },
    clock,
  );
  for (const [index, planned] of history.entries()) {
    await writeVersion(db, row, people, index + 1, planned);
  }
  const approvedAt = history[history.length - 1]?.reviewedAt ?? row.completedAt;
  await db
    .update(deliverables)
    .set({
      status: 'approved',
      reviewerUserId: row.reviewerUserId ?? people.reviewer,
      currentVersionNumber: history.length,
      approvedAt,
      version: sql`${deliverables.version} + ${history.length * 2}`,
      updatedAt: approvedAt,
    })
    .where(eq(deliverables.id, row.id));
  if (history.length > 1 && row.requiresReview) {
    await db.update(tasks).set({ reviewRounds: 1 }).where(eq(tasks.id, row.taskId));
  }
  return history.length;
}

/**
 * Review history for deliverables of finished tasks (approved, about a
 * quarter after one round of changes) and two fresh submissions on tasks
 * that are with their reviewer now. Within the current month each person
 * reworks at most once, so this month's "approved first time" stays fair.
 */
export async function seedReviewHistory(
  db: Database,
  clock: HistoryClock,
  scope: readonly HistoryProject[],
  studioOwnerId: string,
): Promise<{ decided: number; waiting: number; reworked: number }> {
  const projects = new Map(scope.map((project) => [project.id, project]));
  const rows = await loadDeliverables(db, [...projects.keys()]);
  const month = clock.today.slice(0, 7);
  const reworkedThisMonth = new Set<string>();
  const totals = { decided: 0, waiting: 0, reworked: 0 };
  for (const row of rows) {
    const project = projects.get(row.projectId);
    if (!project) continue;
    const submitter = row.ownerUserId ?? project.managerUserId;
    const reviewer = reviewerFor(row, project.managerUserId, submitter, studioOwnerId);
    const people = { submitter, reviewer };
    if (row.status === 'in_review' && totals.waiting < WAITING_FOR_REVIEW && !project.isFinished) {
      await submitForReview(db, clock, row, people);
      totals.waiting += 1;
    } else if (row.status === 'done' && row.completedAt) {
      const thisMonth = clock.dateOf(row.completedAt).startsWith(month);
      const mayRework = !thisMonth || !reworkedThisMonth.has(submitter);
      const key = `${project.name}/${row.name}`;
      const completed = { ...row, completedAt: row.completedAt };
      const versions = await approveWithHistory(db, clock, completed, people, { key, mayRework });
      totals.decided += versions;
      if (versions === 1) continue;
      totals.reworked += 1;
      if (thisMonth) reworkedThisMonth.add(submitter);
    }
  }
  return totals;
}
