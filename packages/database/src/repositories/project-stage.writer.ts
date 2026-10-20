import { OPEN_TASK_STATUSES } from '@lintel/domain';
import { and, asc, count, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { milestones, projectStages, tasks } from '../schema';

/** True when the stage has no pending milestone and no open task left. */
export async function stageIsClosed(db: DatabaseExecutor, stageId: string): Promise<boolean> {
  const [pending] = await db
    .select({ total: count() })
    .from(milestones)
    .where(and(eq(milestones.stageId, stageId), eq(milestones.status, 'pending')));
  if ((pending?.total ?? 0) > 0) return false;
  const [open] = await db
    .select({ total: count() })
    .from(tasks)
    .where(
      and(
        eq(tasks.stageId, stageId),
        inArray(tasks.status, [...OPEN_TASK_STATUSES]),
        isNull(tasks.archivedAt),
      ),
    );
  return (open?.total ?? 0) === 0;
}

/** Marks the stage completed and makes the next pending stage (by position) active. */
export async function completeStageAndActivateNext(
  db: DatabaseExecutor,
  stageId: string,
  at: Date,
): Promise<{ activated: string | null }> {
  const [stage] = await db
    .update(projectStages)
    .set({ status: 'completed', completedAt: at, updatedAt: at })
    .where(eq(projectStages.id, stageId))
    .returning();
  if (!stage) return { activated: null };
  const [next] = await db
    .select()
    .from(projectStages)
    .where(
      and(
        eq(projectStages.projectId, stage.projectId),
        eq(projectStages.status, 'pending'),
        gt(projectStages.position, stage.position),
      ),
    )
    .orderBy(asc(projectStages.position))
    .limit(1);
  if (!next) return { activated: null };
  await db
    .update(projectStages)
    .set({ status: 'active', startedAt: at, updatedAt: at })
    .where(eq(projectStages.id, next.id));
  return { activated: next.name };
}
