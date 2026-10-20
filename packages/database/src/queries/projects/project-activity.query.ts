import { count, desc, eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { activityEvents, projects } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { ProjectRefView, UserSummaryView } from '../shared/view-types';

export interface ActivityItemView {
  readonly id: string;
  readonly type: string;
  readonly summary: string;
  readonly actor: UserSummaryView | null;
  readonly project: ProjectRefView | null;
  readonly taskId: string | null;
  readonly createdAt: string;
}

/** The project feed, newest first. Callers check project access first. */
export async function queryProjectActivity(
  db: DatabaseExecutor,
  projectId: string,
  page: { page: number; pageSize: number },
): Promise<{ items: ActivityItemView[]; totalItems: number }> {
  const where = eq(activityEvents.projectId, projectId);
  const [[totals], rows, [project]] = await Promise.all([
    db.select({ total: count() }).from(activityEvents).where(where),
    db
      .select()
      .from(activityEvents)
      .where(where)
      .orderBy(desc(activityEvents.createdAt), desc(activityEvents.id))
      .limit(page.pageSize)
      .offset((page.page - 1) * page.pageSize),
    db
      .select({
        id: projects.id,
        reference: projects.reference,
        name: projects.name,
        colorIndex: projects.colorIndex,
      })
      .from(projects)
      .where(eq(projects.id, projectId)),
  ]);
  const actors = await loadUserSummaries(
    db,
    rows.map((row) => row.actorUserId),
  );
  return {
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      summary: row.summary,
      actor: pickUser(actors, row.actorUserId),
      project: project ?? null,
      taskId: row.taskId,
      createdAt: row.createdAt.toISOString(),
    })),
    totalItems: totals?.total ?? 0,
  };
}
