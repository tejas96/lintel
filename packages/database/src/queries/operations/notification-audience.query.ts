import { and, eq, inArray, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { projects } from '../../schema';

/** Whether the person manages or owns a project that can still raise manager notifications. */
export async function managesOpenProjects(db: DatabaseExecutor, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        or(eq(projects.managerUserId, userId), eq(projects.ownerUserId, userId)),
        inArray(projects.status, ['draft', 'active', 'on_hold']),
      ),
    )
    .limit(1);
  return row !== undefined;
}
