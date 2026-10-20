import type { WorkSessionStore } from '@lintel/application';
import { and, eq, isNull } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { priorityConflicts, users, workSessions } from '../schema';

const sessionColumns = {
  id: workSessions.id,
  taskId: workSessions.taskId,
  userId: workSessions.userId,
  startedAt: workSessions.startedAt,
  endedAt: workSessions.endedAt,
};

/** Work sessions and priority conflicts. */
export class WorkSessionRepository implements WorkSessionStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async lockPerson(userId: string) {
    await this.db.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
  }

  async activeSessionFor(userId: string) {
    const [row] = await this.db
      .select(sessionColumns)
      .from(workSessions)
      .where(and(eq(workSessions.userId, userId), isNull(workSessions.endedAt)))
      .limit(1);
    return row ?? null;
  }

  activeSessionsOnTask(taskId: string) {
    return this.db
      .select(sessionColumns)
      .from(workSessions)
      .where(and(eq(workSessions.taskId, taskId), isNull(workSessions.endedAt)));
  }

  async startSession(taskId: string, userId: string, at: Date) {
    const [row] = await this.db
      .insert(workSessions)
      .values({ taskId, userId, startedAt: at })
      .returning(sessionColumns);
    if (!row) throw new Error('Starting the work session returned no row.');
    return row;
  }

  async endSession(sessionId: string, at: Date) {
    await this.db
      .update(workSessions)
      .set({ endedAt: at })
      .where(and(eq(workSessions.id, sessionId), isNull(workSessions.endedAt)));
  }

  async createPriorityConflict(input: {
    readonly raisedByUserId: string;
    readonly taskIds: readonly string[];
    readonly note: string;
  }) {
    const [row] = await this.db
      .insert(priorityConflicts)
      .values({
        raisedByUserId: input.raisedByUserId,
        taskIds: [...input.taskIds],
        note: input.note,
      })
      .returning({ id: priorityConflicts.id });
    if (!row) throw new Error('Saving the priority conflict returned no row.');
    return row;
  }

  async findPriorityConflictForUpdate(conflictId: string) {
    const [row] = await this.db
      .select({
        id: priorityConflicts.id,
        raisedByUserId: priorityConflicts.raisedByUserId,
        taskIds: priorityConflicts.taskIds,
        note: priorityConflicts.note,
        status: priorityConflicts.status,
      })
      .from(priorityConflicts)
      .where(eq(priorityConflicts.id, conflictId))
      .for('update');
    return row ?? null;
  }

  async resolvePriorityConflict(
    conflictId: string,
    resolution: { readonly at: Date; readonly byUserId: string; readonly note: string },
  ) {
    await this.db
      .update(priorityConflicts)
      .set({
        status: 'resolved',
        resolvedAt: resolution.at,
        resolvedByUserId: resolution.byUserId,
        resolution: resolution.note,
      })
      .where(eq(priorityConflicts.id, conflictId));
  }
}
