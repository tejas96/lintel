import { and, asc, eq, isNull } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import {
  taskAttachments,
  taskChecklistItems,
  taskCollaborators,
  taskScheduleChanges,
  workSessions,
} from '../../schema';
import { loadFileSummaries, pickFiles } from '../deliverables/file-summary.query';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';

export interface ChecklistItemView {
  readonly id: string;
  readonly label: string;
  readonly isRequired: boolean;
  readonly position: number;
  readonly completedAt: string | null;
  readonly completedBy: UserSummaryView | null;
}

export interface ScheduleChangeView {
  readonly id: string;
  readonly previousDueDate: string | null;
  readonly newDueDate: string | null;
  readonly previousDueTime: string | null;
  readonly newDueTime: string | null;
  readonly reason: string;
  readonly changedBy: UserSummaryView;
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

export async function loadChecklistItems(
  db: DatabaseExecutor,
  taskId: string,
): Promise<ChecklistItemView[]> {
  const rows = await db
    .select()
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.taskId, taskId))
    .orderBy(asc(taskChecklistItems.position), asc(taskChecklistItems.createdAt));
  const people = await loadUserSummaries(
    db,
    rows.map((row) => row.completedByUserId),
  );
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    isRequired: row.isRequired,
    position: row.position,
    completedAt: row.completedAt?.toISOString() ?? null,
    completedBy: pickUser(people, row.completedByUserId),
  }));
}

export async function loadScheduleChanges(
  db: DatabaseExecutor,
  taskId: string,
): Promise<ScheduleChangeView[]> {
  const rows = await db
    .select()
    .from(taskScheduleChanges)
    .where(eq(taskScheduleChanges.taskId, taskId))
    .orderBy(asc(taskScheduleChanges.createdAt));
  const people = await loadUserSummaries(
    db,
    rows.map((row) => row.changedByUserId),
  );
  return rows.map((row) => ({
    id: row.id,
    previousDueDate: row.previousDueDate,
    newDueDate: row.newDueDate,
    previousDueTime: row.previousDueTime,
    newDueTime: row.newDueTime,
    reason: row.reason,
    changedBy: pickUser(people, row.changedByUserId) ?? FORMER_MEMBER,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function loadCollaborators(
  db: DatabaseExecutor,
  taskId: string,
): Promise<UserSummaryView[]> {
  const rows = await db
    .select({ userId: taskCollaborators.userId })
    .from(taskCollaborators)
    .where(eq(taskCollaborators.taskId, taskId))
    .orderBy(asc(taskCollaborators.addedAt));
  const people = await loadUserSummaries(
    db,
    rows.map((row) => row.userId),
  );
  return rows
    .map((row) => people.get(row.userId))
    .filter((person): person is UserSummaryView => Boolean(person));
}

export async function loadAttachments(db: DatabaseExecutor, taskId: string) {
  const rows = await db
    .select({ fileId: taskAttachments.fileId })
    .from(taskAttachments)
    .where(eq(taskAttachments.taskId, taskId))
    .orderBy(asc(taskAttachments.createdAt));
  const ids = rows.map((row) => row.fileId);
  return pickFiles(await loadFileSummaries(db, ids), ids);
}

/** When the viewer's running session on this task started, if one is running. */
export async function activeSessionStart(
  db: DatabaseExecutor,
  taskId: string,
  viewerUserId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ startedAt: workSessions.startedAt })
    .from(workSessions)
    .where(
      and(
        eq(workSessions.taskId, taskId),
        eq(workSessions.userId, viewerUserId),
        isNull(workSessions.endedAt),
      ),
    )
    .limit(1);
  return row?.startedAt.toISOString() ?? null;
}
