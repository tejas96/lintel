import type { ApproverDirectory, HandoverTaskRecord, LeaveWorkItem } from '@lintel/application';
import { OPEN_TASK_STATUSES } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import { and, asc, desc, eq, inArray, isNull, ne, notInArray, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { milestones, projectMembers, projects, roleCapabilities, tasks, users } from '../schema';

/** Open, non-archived tasks the person owns on live projects, with their project manager. */
export async function loadOpenWorkOf(
  db: DatabaseExecutor,
  userId: string,
): Promise<LeaveWorkItem[]> {
  const rows = await db
    .select({
      taskId: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      plannedStartDate: tasks.plannedStartDate,
      dueDate: tasks.dueDate,
      projectId: projects.id,
      projectName: projects.name,
      projectCriticality: projects.criticality,
      projectManagerUserId: projects.managerUserId,
      milestoneName: milestones.name,
      milestoneDueDate: milestones.dueDate,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(milestones, eq(milestones.id, tasks.milestoneId))
    .where(
      and(
        eq(tasks.ownerUserId, userId),
        inArray(tasks.status, [...OPEN_TASK_STATUSES]),
        isNull(tasks.archivedAt),
        notInArray(projects.status, ['cancelled', 'archived']),
      ),
    )
    .orderBy(asc(tasks.dueDate));
  return rows.map((row) => ({
    ...row,
    plannedStartDate: row.plannedStartDate as CalendarDate | null,
    dueDate: row.dueDate as CalendarDate | null,
    milestoneDueDate: row.milestoneDueDate as CalendarDate | null,
  }));
}

/** The active owner, and active non-owners whose role holds `leave.approve_any` (admins first). */
export async function loadApproverDirectory(db: DatabaseExecutor): Promise<ApproverDirectory> {
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'owner'), eq(users.status, 'active')))
    .orderBy(asc(users.createdAt))
    .limit(1);
  const delegates = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(roleCapabilities, eq(roleCapabilities.role, users.role))
    .where(
      and(
        eq(roleCapabilities.capability, 'leave.approve_any'),
        ne(users.role, 'owner'),
        eq(users.status, 'active'),
      ),
    )
    .orderBy(desc(sql`${users.role} = 'administrator'`), asc(users.createdAt));
  return {
    ownerUserId: owner?.id ?? null,
    delegateUserIds: delegates.map((row) => row.id),
  };
}

export async function loadHandoverTask(
  db: DatabaseExecutor,
  taskId: string,
): Promise<HandoverTaskRecord | null> {
  const [row] = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      title: tasks.title,
      ownerUserId: tasks.ownerUserId,
      version: tasks.version,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId));
  return row ?? null;
}

/** New owner, version bumped; the new owner must acknowledge the task again. */
export async function reassignTaskOwnerRow(
  db: DatabaseExecutor,
  taskId: string,
  expectedVersion: number,
  ownerUserId: string,
): Promise<boolean> {
  const rows = await db
    .update(tasks)
    .set({
      ownerUserId,
      acknowledgedAt: null,
      version: sql`${tasks.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.version, expectedVersion)))
    .returning({ id: tasks.id });
  return rows.length > 0;
}

export async function ensureProjectMemberRow(
  db: DatabaseExecutor,
  projectId: string,
  userId: string,
): Promise<void> {
  await db
    .insert(projectMembers)
    .values({ projectId, userId, projectRole: 'member' })
    .onConflictDoNothing();
}
