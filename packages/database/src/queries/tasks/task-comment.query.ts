import { asc, eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { taskComments } from '../../schema';
import { loadUserSummaries } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';

export interface TaskCommentView {
  readonly id: string;
  readonly author: UserSummaryView;
  readonly body: string;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

const FORMER_MEMBER: UserSummaryView = {
  id: '00000000-0000-0000-0000-000000000000',
  fullName: 'Former member',
  designation: null,
  role: 'employee',
  avatarHue: 0,
  status: 'deactivated',
};

/** Comments on a task, oldest first (a conversation reads top to bottom). */
export async function listTaskComments(
  db: DatabaseExecutor,
  taskId: string,
): Promise<TaskCommentView[]> {
  const rows = await db
    .select()
    .from(taskComments)
    .where(eq(taskComments.taskId, taskId))
    .orderBy(asc(taskComments.createdAt))
    .limit(500);
  const people = await loadUserSummaries(
    db,
    rows.map((row) => row.authorUserId),
  );
  return rows.map((row) => toCommentView(row, people));
}

export async function findTaskComment(
  db: DatabaseExecutor,
  commentId: string,
): Promise<TaskCommentView | null> {
  const [row] = await db.select().from(taskComments).where(eq(taskComments.id, commentId));
  if (!row) return null;
  return toCommentView(row, await loadUserSummaries(db, [row.authorUserId]));
}

function toCommentView(
  row: typeof taskComments.$inferSelect,
  people: Map<string, UserSummaryView>,
): TaskCommentView {
  return {
    id: row.id,
    author: people.get(row.authorUserId) ?? FORMER_MEMBER,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
  };
}
