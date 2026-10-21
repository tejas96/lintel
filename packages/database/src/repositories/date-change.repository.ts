import type {
  DateChangeRequestRecord,
  DateChangeResolution,
  DateChangeStore,
  NewDateChangeRequest,
} from '@lintel/application';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { taskDateChangeRequests } from '../schema';

const requestColumns = {
  id: taskDateChangeRequests.id,
  taskId: taskDateChangeRequests.taskId,
  projectId: taskDateChangeRequests.projectId,
  requestedByUserId: taskDateChangeRequests.requestedByUserId,
  previousStartDate: taskDateChangeRequests.previousStartDate,
  previousDueDate: taskDateChangeRequests.previousDueDate,
  proposedStartDate: taskDateChangeRequests.proposedStartDate,
  proposedDueDate: taskDateChangeRequests.proposedDueDate,
  reason: taskDateChangeRequests.reason,
  status: taskDateChangeRequests.status,
  decidedByUserId: taskDateChangeRequests.decidedByUserId,
  decisionNote: taskDateChangeRequests.decisionNote,
  version: taskDateChangeRequests.version,
};

/** New-date requests. A partial unique index keeps one open request per task. */
export class DateChangeRepository implements DateChangeStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async insert(request: NewDateChangeRequest): Promise<DateChangeRequestRecord> {
    const [row] = await this.db
      .insert(taskDateChangeRequests)
      .values(request)
      .returning(requestColumns);
    if (!row) throw new Error('Saving the new-date request returned no row.');
    return row;
  }

  async find(requestId: string): Promise<DateChangeRequestRecord | null> {
    const [row] = await this.db
      .select(requestColumns)
      .from(taskDateChangeRequests)
      .where(eq(taskDateChangeRequests.id, requestId));
    return row ?? null;
  }

  async findForUpdate(requestId: string): Promise<DateChangeRequestRecord | null> {
    const [row] = await this.db
      .select(requestColumns)
      .from(taskDateChangeRequests)
      .where(eq(taskDateChangeRequests.id, requestId))
      .for('update');
    return row ?? null;
  }

  async openForTask(taskId: string): Promise<DateChangeRequestRecord | null> {
    const [row] = await this.db
      .select(requestColumns)
      .from(taskDateChangeRequests)
      .where(
        and(eq(taskDateChangeRequests.taskId, taskId), eq(taskDateChangeRequests.status, 'open')),
      )
      .orderBy(desc(taskDateChangeRequests.createdAt))
      .limit(1);
    return row ?? null;
  }

  async resolve(requestId: string, expectedVersion: number, resolution: DateChangeResolution) {
    const rows = await this.db
      .update(taskDateChangeRequests)
      .set({
        status: resolution.status,
        decidedByUserId: resolution.decidedByUserId,
        decidedAt: resolution.at,
        decisionNote: resolution.note,
        version: sql`${taskDateChangeRequests.version} + 1`,
        updatedAt: resolution.at,
      })
      .where(
        and(
          eq(taskDateChangeRequests.id, requestId),
          eq(taskDateChangeRequests.version, expectedVersion),
          eq(taskDateChangeRequests.status, 'open'),
        ),
      )
      .returning({ id: taskDateChangeRequests.id });
    return rows.length > 0;
  }
}
