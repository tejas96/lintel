import { asc, desc, eq, inArray, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { projects, siteUpdatePhotos, siteUpdates } from '../../schema';
import { loadUserSummaries } from '../shared/user-summary.query';
import type { ProjectRefView, TaskRefView, UserSummaryView } from '../shared/view-types';
import { loadTaskRefMap } from '../tasks/task-ref.query';
import { type FileSummaryView, loadFileSummaries, pickFiles } from './file-summary.query';

export interface SiteUpdateView {
  readonly id: string;
  readonly project: ProjectRefView;
  readonly task: TaskRefView | null;
  readonly author: UserSummaryView;
  readonly note: string;
  readonly hasIssue: boolean;
  readonly photos: FileSummaryView[];
  readonly createdAt: string;
}

const FORMER_MEMBER: UserSummaryView = {
  id: '00000000-0000-0000-0000-000000000000',
  fullName: 'Former member',
  designation: null,
  role: 'employee',
  avatarHue: 0,
  status: 'deactivated',
};

async function loadSiteUpdates(db: DatabaseExecutor, where: SQL): Promise<SiteUpdateView[]> {
  const rows = await db
    .select({
      update: siteUpdates,
      project: {
        id: projects.id,
        reference: projects.reference,
        name: projects.name,
        colorIndex: projects.colorIndex,
      },
    })
    .from(siteUpdates)
    .innerJoin(projects, eq(projects.id, siteUpdates.projectId))
    .where(where)
    .orderBy(desc(siteUpdates.createdAt))
    .limit(200);
  if (rows.length === 0) return [];
  const photos = await db
    .select({ siteUpdateId: siteUpdatePhotos.siteUpdateId, fileId: siteUpdatePhotos.fileId })
    .from(siteUpdatePhotos)
    .where(
      inArray(
        siteUpdatePhotos.siteUpdateId,
        rows.map((row) => row.update.id),
      ),
    )
    .orderBy(asc(siteUpdatePhotos.position));
  const [fileMap, taskRefs, people] = await Promise.all([
    loadFileSummaries(
      db,
      photos.map((photo) => photo.fileId),
    ),
    loadTaskRefMap(
      db,
      rows.map((row) => row.update.taskId),
    ),
    loadUserSummaries(
      db,
      rows.map((row) => row.update.authorUserId),
    ),
  ]);
  return rows.map(({ update, project }) => ({
    id: update.id,
    project,
    task: update.taskId ? (taskRefs.get(update.taskId) ?? null) : null,
    author: people.get(update.authorUserId) ?? FORMER_MEMBER,
    note: update.note,
    hasIssue: update.hasIssue,
    photos: pickFiles(
      fileMap,
      photos.filter((photo) => photo.siteUpdateId === update.id).map((photo) => photo.fileId),
    ),
    createdAt: update.createdAt.toISOString(),
  }));
}

/** Site updates of a project, newest first. */
export function listSiteUpdates(db: DatabaseExecutor, projectId: string) {
  return loadSiteUpdates(db, eq(siteUpdates.projectId, projectId));
}

export async function findSiteUpdate(
  db: DatabaseExecutor,
  siteUpdateId: string,
): Promise<SiteUpdateView | null> {
  const [row] = await loadSiteUpdates(db, eq(siteUpdates.id, siteUpdateId));
  return row ?? null;
}
