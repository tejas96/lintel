import { isHandedBack, isHandoverSuperseded } from '@lintel/domain';
import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { activityEvents, leaveHandovers, tasks } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { TaskRefView, UserSummaryView } from '../shared/view-types';

export interface LeaveHandoverView {
  readonly id: string;
  readonly task: TaskRefView;
  readonly to: UserSummaryView | null;
  readonly note: string | null;
  readonly status: 'proposed' | 'accepted' | 'declined' | 'applied';
  /** Who owns the task now. */
  readonly currentOwner: UserSummaryView | null;
  /**
   * Set when the handover was applied and the task changed owner again later:
   * `handedBack` when it is with the person on leave once more (cover needed).
   */
  readonly superseded: {
    readonly at: string | null;
    readonly handedBack: boolean;
  } | null;
}

/** Activity types that change a task's owner (direct assignment, accepted requests, handovers). */
const OWNER_CHANGES = ['task.assigned', 'task.reassigned'];

/** When each superseded task last changed owner after its handover was applied. */
async function lastOwnerChanges(
  db: DatabaseExecutor,
  superseded: readonly { taskId: string; after: Date }[],
): Promise<Map<string, Date>> {
  const changes = new Map<string, Date>();
  for (const item of superseded) {
    const [row] = await db
      .select({ createdAt: activityEvents.createdAt })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.taskId, item.taskId),
          inArray(activityEvents.type, OWNER_CHANGES),
          gt(activityEvents.createdAt, item.after),
        ),
      )
      .orderBy(desc(activityEvents.createdAt))
      .limit(1);
    if (row) changes.set(item.taskId, row.createdAt);
  }
  return changes;
}

/** The handovers of one request, read against each task's current owner. */
export async function loadLeaveHandoverViews(
  db: DatabaseExecutor,
  request: { readonly id: string; readonly userId: string },
): Promise<LeaveHandoverView[]> {
  const rows = await db
    .select({
      id: leaveHandovers.id,
      note: leaveHandovers.note,
      status: leaveHandovers.status,
      toUserId: leaveHandovers.toUserId,
      decidedAt: leaveHandovers.decidedAt,
      ownerUserId: tasks.ownerUserId,
      task: {
        id: tasks.id,
        number: tasks.number,
        title: tasks.title,
        status: tasks.status,
        dueDate: tasks.dueDate,
      },
    })
    .from(leaveHandovers)
    .innerJoin(tasks, eq(tasks.id, leaveHandovers.taskId))
    .where(eq(leaveHandovers.leaveRequestId, request.id))
    .orderBy(asc(leaveHandovers.createdAt));
  const facts = (row: (typeof rows)[number]) => ({
    status: row.status,
    toUserId: row.toUserId,
    taskOwnerUserId: row.ownerUserId,
    absentUserId: request.userId,
  });
  const [people, changes] = await Promise.all([
    loadUserSummaries(
      db,
      rows.flatMap((row) => [row.toUserId, row.ownerUserId]),
    ),
    lastOwnerChanges(
      db,
      rows.flatMap((row) =>
        isHandoverSuperseded(facts(row)) && row.decidedAt
          ? [{ taskId: row.task.id, after: row.decidedAt }]
          : [],
      ),
    ),
  ]);
  return rows.map(({ toUserId, ownerUserId, decidedAt: _decidedAt, ...row }) => {
    const ownership = facts({ ...row, toUserId, ownerUserId, decidedAt: null });
    return {
      ...row,
      to: pickUser(people, toUserId),
      currentOwner: pickUser(people, ownerUserId),
      superseded: isHandoverSuperseded(ownership)
        ? {
            at: changes.get(row.task.id)?.toISOString() ?? null,
            handedBack: isHandedBack(ownership),
          }
        : null,
    };
  });
}
