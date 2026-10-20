import type { DeliverableStatus } from '@lintel/domain';
import { and, asc, desc, eq, inArray, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { deliverables, deliverableVersions, projects } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { ProjectRefView, TaskRefView, UserSummaryView } from '../shared/view-types';
import { loadTaskRefMap } from '../tasks/task-ref.query';
import { type FileSummaryView, loadFileSummaries } from './file-summary.query';

export interface DeliverableVersionView {
  readonly id: string;
  readonly versionNumber: number;
  readonly file: FileSummaryView;
  readonly note: string | null;
  readonly submittedBy: UserSummaryView;
  readonly submittedAt: string;
  readonly decision: 'pending' | 'approved' | 'changes_requested' | 'rejected';
  readonly reviewedBy: UserSummaryView | null;
  readonly reviewedAt: string | null;
  readonly reviewComment: string | null;
}

export interface DeliverableSummaryView {
  readonly id: string;
  readonly project: ProjectRefView;
  readonly task: TaskRefView | null;
  readonly name: string;
  readonly isRequired: boolean;
  readonly status: DeliverableStatus;
  readonly reviewer: UserSummaryView | null;
  readonly currentVersionNumber: number;
  readonly latestVersion: DeliverableVersionView | null;
  readonly version: number;
}

export interface DeliverableDetailView extends DeliverableSummaryView {
  readonly description: string | null;
  /** Newest first. */
  readonly versions: DeliverableVersionView[];
}

const FORMER_MEMBER: UserSummaryView = {
  id: '00000000-0000-0000-0000-000000000000',
  fullName: 'Former member',
  designation: null,
  role: 'employee',
  avatarHue: 0,
  status: 'deactivated',
};

/** Versions of the given deliverables, newest first, grouped by deliverable. */
async function loadVersions(db: DatabaseExecutor, deliverableIds: readonly string[]) {
  const byDeliverable = new Map<string, DeliverableVersionView[]>();
  if (deliverableIds.length === 0) return byDeliverable;
  const rows = await db
    .select()
    .from(deliverableVersions)
    .where(inArray(deliverableVersions.deliverableId, [...deliverableIds]))
    .orderBy(desc(deliverableVersions.versionNumber));
  const [fileMap, people] = await Promise.all([
    loadFileSummaries(
      db,
      rows.map((row) => row.fileId),
      true,
    ),
    loadUserSummaries(
      db,
      rows.flatMap((row) => [row.submittedByUserId, row.reviewedByUserId]),
    ),
  ]);
  for (const row of rows) {
    const file = fileMap.get(row.fileId);
    if (!file) continue;
    const list = byDeliverable.get(row.deliverableId) ?? [];
    list.push({
      id: row.id,
      versionNumber: row.versionNumber,
      file,
      note: row.note,
      submittedBy: pickUser(people, row.submittedByUserId) ?? FORMER_MEMBER,
      submittedAt: row.submittedAt.toISOString(),
      decision: row.decision,
      reviewedBy: pickUser(people, row.reviewedByUserId),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewComment: row.reviewComment,
    });
    byDeliverable.set(row.deliverableId, list);
  }
  return byDeliverable;
}

async function loadDeliverables(db: DatabaseExecutor, where: SQL | undefined) {
  const rows = await db
    .select({
      deliverable: deliverables,
      project: {
        id: projects.id,
        reference: projects.reference,
        name: projects.name,
        colorIndex: projects.colorIndex,
      },
    })
    .from(deliverables)
    .innerJoin(projects, eq(projects.id, deliverables.projectId))
    .where(and(where))
    .orderBy(asc(deliverables.createdAt));
  const ids = rows.map((row) => row.deliverable.id);
  const [versions, taskRefs, people] = await Promise.all([
    loadVersions(db, ids),
    loadTaskRefMap(
      db,
      rows.map((row) => row.deliverable.taskId),
    ),
    loadUserSummaries(
      db,
      rows.map((row) => row.deliverable.reviewerUserId),
    ),
  ]);
  return rows.map(({ deliverable, project }) => {
    const history = versions.get(deliverable.id) ?? [];
    return {
      id: deliverable.id,
      project,
      task: deliverable.taskId ? (taskRefs.get(deliverable.taskId) ?? null) : null,
      name: deliverable.name,
      isRequired: deliverable.isRequired,
      status: deliverable.status,
      reviewer: pickUser(people, deliverable.reviewerUserId),
      currentVersionNumber: deliverable.currentVersionNumber,
      latestVersion: history[0] ?? null,
      version: deliverable.version,
      description: deliverable.description,
      versions: history,
    };
  });
}

/** Deliverables of a project in the order they were planned. */
export async function listProjectDeliverables(
  db: DatabaseExecutor,
  projectId: string,
): Promise<DeliverableSummaryView[]> {
  const rows = await loadDeliverables(db, eq(deliverables.projectId, projectId));
  return rows.map(({ description: _d, versions: _v, ...summary }) => summary);
}

export async function findDeliverableDetail(
  db: DatabaseExecutor,
  deliverableId: string,
): Promise<DeliverableDetailView | null> {
  const [row] = await loadDeliverables(db, eq(deliverables.id, deliverableId));
  return row ?? null;
}
