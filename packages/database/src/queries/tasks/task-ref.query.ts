import { and, asc, inArray, isNull, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { tasks } from '../../schema';
import type { TaskRefView } from '../shared/view-types';

export const taskRefColumns = {
  id: tasks.id,
  number: tasks.number,
  title: tasks.title,
  status: tasks.status,
  dueDate: tasks.dueDate,
};

/** Task references (number, title, status, due date) matching a condition. */
export function loadTaskRefs(db: DatabaseExecutor, where: SQL | undefined): Promise<TaskRefView[]> {
  return db
    .select(taskRefColumns)
    .from(tasks)
    .where(and(isNull(tasks.archivedAt), where))
    .orderBy(asc(tasks.number));
}

export async function loadTaskRefMap(
  db: DatabaseExecutor,
  taskIds: readonly (string | null)[],
): Promise<Map<string, TaskRefView>> {
  const ids = [...new Set(taskIds.filter((id): id is string => id !== null))];
  if (ids.length === 0) return new Map();
  const rows = await loadTaskRefs(db, inArray(tasks.id, ids));
  return new Map(rows.map((row) => [row.id, row]));
}
