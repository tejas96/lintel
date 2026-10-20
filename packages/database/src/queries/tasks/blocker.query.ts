import type { BlockerCategory } from '@lintel/application';
import { and, desc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { taskBlockers, tasks } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';

export interface BlockerView {
  readonly id: string;
  readonly taskId: string;
  readonly category: BlockerCategory;
  readonly reason: string;
  readonly waitingOn: UserSummaryView | null;
  readonly raisedBy: UserSummaryView;
  readonly raisedAt: string;
  readonly resolvedAt: string | null;
  readonly resolvedBy: UserSummaryView | null;
  readonly resolution: string | null;
}

const FORMER_MEMBER: UserSummaryView = {
  id: '00000000-0000-0000-0000-000000000000',
  fullName: 'Former member',
  designation: null,
  role: 'employee',
  avatarHue: 0,
  status: 'deactivated',
};

/** Blocker views, newest first. */
export async function loadBlockerViews(
  db: DatabaseExecutor,
  where: SQL | undefined,
): Promise<BlockerView[]> {
  const rows = await db
    .select()
    .from(taskBlockers)
    .where(where)
    .orderBy(desc(taskBlockers.raisedAt))
    .limit(500);
  const people = await loadUserSummaries(
    db,
    rows.flatMap((row) => [row.raisedByUserId, row.waitingOnUserId, row.resolvedByUserId]),
  );
  return rows.map((row) => ({
    id: row.id,
    taskId: row.taskId,
    category: row.category,
    reason: row.reason,
    waitingOn: pickUser(people, row.waitingOnUserId),
    raisedBy: pickUser(people, row.raisedByUserId) ?? FORMER_MEMBER,
    raisedAt: row.raisedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedBy: pickUser(people, row.resolvedByUserId),
    resolution: row.resolution,
  }));
}

/** Open blockers in the given projects ("all" for people who see every project). */
export function listOpenBlockers(
  db: DatabaseExecutor,
  projectIds: readonly string[] | 'all',
): Promise<BlockerView[]> {
  if (projectIds !== 'all' && projectIds.length === 0) return Promise.resolve([]);
  const scope =
    projectIds === 'all'
      ? isNull(tasks.archivedAt)
      : and(isNull(tasks.archivedAt), inArray(tasks.projectId, [...projectIds]));
  const taskIds = db.select({ id: tasks.id }).from(tasks).where(scope);
  return loadBlockerViews(
    db,
    and(isNull(taskBlockers.resolvedAt), inArray(taskBlockers.taskId, taskIds)),
  );
}

export function loadTaskBlockers(db: DatabaseExecutor, taskId: string): Promise<BlockerView[]> {
  return loadBlockerViews(db, eq(taskBlockers.taskId, taskId));
}
