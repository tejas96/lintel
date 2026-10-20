import type { BlockerRecord, NewBlocker, TaskItemStore } from '@lintel/application';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { taskBlockers, taskChecklistItems, taskComments } from '../schema';

function toBlocker(row: typeof taskBlockers.$inferSelect): BlockerRecord {
  return {
    id: row.id,
    taskId: row.taskId,
    category: row.category,
    reason: row.reason,
    waitingOnUserId: row.waitingOnUserId,
    raisedByUserId: row.raisedByUserId,
    raisedAt: row.raisedAt,
    resolvedAt: row.resolvedAt,
  };
}

const checklistColumns = {
  id: taskChecklistItems.id,
  taskId: taskChecklistItems.taskId,
  label: taskChecklistItems.label,
  isRequired: taskChecklistItems.isRequired,
  position: taskChecklistItems.position,
  completedAt: taskChecklistItems.completedAt,
};

/** Checklist items, blockers and comments. */
export class TaskItemRepository implements TaskItemStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async addChecklistItems(
    taskId: string,
    items: readonly { label: string; isRequired: boolean }[],
  ) {
    if (items.length === 0) return [];
    const [last] = await this.db
      .select({ position: sql<number>`coalesce(max(${taskChecklistItems.position}), -1)::int` })
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.taskId, taskId));
    const start = (last?.position ?? -1) + 1;
    return this.db
      .insert(taskChecklistItems)
      .values(items.map((item, index) => ({ taskId, ...item, position: start + index })))
      .returning(checklistColumns);
  }

  async findChecklistItem(itemId: string) {
    const [row] = await this.db
      .select(checklistColumns)
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.id, itemId));
    return row ?? null;
  }

  async setChecklistItemCompletion(
    itemId: string,
    completion: { readonly at: Date; readonly byUserId: string } | null,
  ) {
    await this.db
      .update(taskChecklistItems)
      .set({
        completedAt: completion?.at ?? null,
        completedByUserId: completion?.byUserId ?? null,
      })
      .where(eq(taskChecklistItems.id, itemId));
  }

  async removeChecklistItem(itemId: string) {
    await this.db.delete(taskChecklistItems).where(eq(taskChecklistItems.id, itemId));
  }

  async createBlocker(blocker: NewBlocker) {
    const [row] = await this.db.insert(taskBlockers).values(blocker).returning();
    if (!row) throw new Error('Creating the blocker returned no row.');
    return toBlocker(row);
  }

  async findBlockerForUpdate(blockerId: string) {
    const [row] = await this.db
      .select()
      .from(taskBlockers)
      .where(eq(taskBlockers.id, blockerId))
      .for('update');
    return row ? toBlocker(row) : null;
  }

  async resolveBlocker(
    blockerId: string,
    resolution: { readonly at: Date; readonly byUserId: string; readonly note: string },
  ) {
    await this.db
      .update(taskBlockers)
      .set({
        resolvedAt: resolution.at,
        resolvedByUserId: resolution.byUserId,
        resolution: resolution.note,
      })
      .where(and(eq(taskBlockers.id, blockerId), isNull(taskBlockers.resolvedAt)));
  }

  async openBlockerCount(taskId: string) {
    const [row] = await this.db
      .select({ open: count() })
      .from(taskBlockers)
      .where(and(eq(taskBlockers.taskId, taskId), isNull(taskBlockers.resolvedAt)));
    return row?.open ?? 0;
  }

  async addComment(taskId: string, authorUserId: string, body: string) {
    const [row] = await this.db
      .insert(taskComments)
      .values({ taskId, authorUserId, body })
      .returning({ id: taskComments.id });
    if (!row) throw new Error('Creating the comment returned no row.');
    return row;
  }
}
