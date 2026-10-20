import { OPEN_TASK_STATUSES, type TaskStatus } from '@lintel/domain';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { tasks } from '../../schema';
import { loadTaskSummaries } from '../shared/task-summary.query';
import type { TaskSummaryView } from '../shared/view-types';

export type TaskListSort = 'dueDate' | 'priority' | 'number' | 'updatedAt';

export interface TaskListFilter {
  /** Projects the viewer may see, or "all" for people who see every project. */
  readonly visibleProjectIds: readonly string[] | 'all';
  readonly projectId?: string | undefined;
  readonly ownerUserId?: string | undefined;
  readonly status: 'open' | 'all' | TaskStatus;
  /** Due on or before this date. */
  readonly dueBefore?: string | undefined;
  /** Due on or after this date. */
  readonly dueAfter?: string | undefined;
  readonly search?: string | undefined;
  readonly sort: TaskListSort;
  readonly page: number;
  readonly pageSize: number;
  readonly today: string;
}

function searchCondition(search: string): SQL | undefined {
  const pattern = `%${search.replace(/[%_\\]/g, '')}%`;
  const number = /^#?(\d{1,9})$/.exec(search.trim())?.[1];
  return number
    ? or(ilike(tasks.title, pattern), eq(tasks.number, Number(number)))
    : ilike(tasks.title, pattern);
}

function conditions(filter: TaskListFilter): SQL | undefined {
  const parts: (SQL | undefined)[] = [isNull(tasks.archivedAt)];
  if (filter.visibleProjectIds !== 'all') {
    parts.push(inArray(tasks.projectId, [...filter.visibleProjectIds]));
  }
  if (filter.projectId) parts.push(eq(tasks.projectId, filter.projectId));
  if (filter.ownerUserId) parts.push(eq(tasks.ownerUserId, filter.ownerUserId));
  if (filter.status === 'open') parts.push(inArray(tasks.status, [...OPEN_TASK_STATUSES]));
  else if (filter.status !== 'all') parts.push(eq(tasks.status, filter.status));
  if (filter.dueBefore) parts.push(lte(tasks.dueDate, filter.dueBefore));
  if (filter.dueAfter) parts.push(gte(tasks.dueDate, filter.dueAfter));
  if (filter.search) parts.push(searchCondition(filter.search));
  return and(...parts);
}

const dueDateNullsLast = sql`${tasks.dueDate} asc nulls last`;

function ordering(sort: TaskListSort): SQL[] {
  switch (sort) {
    case 'priority':
      return [desc(tasks.priority), dueDateNullsLast, asc(tasks.id)];
    case 'number':
      return [asc(tasks.number), asc(tasks.id)];
    case 'updatedAt':
      return [desc(tasks.updatedAt), asc(tasks.id)];
    case 'dueDate':
      return [dueDateNullsLast, asc(tasks.number), asc(tasks.id)];
  }
}

/** Paginated task list over the viewer's visible projects, built on the shared summary loader. */
export async function queryTasks(
  db: DatabaseExecutor,
  filter: TaskListFilter,
): Promise<{ items: TaskSummaryView[]; totalItems: number }> {
  if (filter.visibleProjectIds !== 'all' && filter.visibleProjectIds.length === 0) {
    return { items: [], totalItems: 0 };
  }
  const where = conditions(filter);
  const [totals] = await db.select({ total: count() }).from(tasks).where(where);
  const items = await loadTaskSummaries(db, {
    where,
    orderBy: ordering(filter.sort),
    limit: filter.pageSize,
    offset: (filter.page - 1) * filter.pageSize,
    today: filter.today,
  });
  return { items, totalItems: totals?.total ?? 0 };
}
