import type {
  NewReassignmentRequest,
  ReassignmentRequestRecord,
  ReassignmentResolution,
  ReassignmentStore,
} from '@lintel/application';
import type { Capability } from '@lintel/domain';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { roleCapabilities, taskReassignmentRequests, users } from '../schema';

const requestColumns = {
  id: taskReassignmentRequests.id,
  taskId: taskReassignmentRequests.taskId,
  projectId: taskReassignmentRequests.projectId,
  requestedByUserId: taskReassignmentRequests.requestedByUserId,
  ownerAtRequestUserId: taskReassignmentRequests.ownerAtRequestUserId,
  suggestedUserId: taskReassignmentRequests.suggestedUserId,
  reason: taskReassignmentRequests.reason,
  status: taskReassignmentRequests.status,
  decidedByUserId: taskReassignmentRequests.decidedByUserId,
  decisionNote: taskReassignmentRequests.decisionNote,
  newOwnerUserId: taskReassignmentRequests.newOwnerUserId,
  version: taskReassignmentRequests.version,
};

/** Task reassignment requests. A partial unique index keeps one open request per task. */
export class ReassignmentRepository implements ReassignmentStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async insert(request: NewReassignmentRequest): Promise<ReassignmentRequestRecord> {
    const [row] = await this.db
      .insert(taskReassignmentRequests)
      .values(request)
      .returning(requestColumns);
    if (!row) throw new Error('Saving the reassignment request returned no row.');
    return row;
  }

  async find(requestId: string): Promise<ReassignmentRequestRecord | null> {
    const [row] = await this.db
      .select(requestColumns)
      .from(taskReassignmentRequests)
      .where(eq(taskReassignmentRequests.id, requestId));
    return row ?? null;
  }

  async findForUpdate(requestId: string): Promise<ReassignmentRequestRecord | null> {
    const [row] = await this.db
      .select(requestColumns)
      .from(taskReassignmentRequests)
      .where(eq(taskReassignmentRequests.id, requestId))
      .for('update');
    return row ?? null;
  }

  async openForTask(taskId: string): Promise<ReassignmentRequestRecord | null> {
    const [row] = await this.db
      .select(requestColumns)
      .from(taskReassignmentRequests)
      .where(
        and(
          eq(taskReassignmentRequests.taskId, taskId),
          eq(taskReassignmentRequests.status, 'open'),
        ),
      )
      .orderBy(desc(taskReassignmentRequests.createdAt))
      .limit(1);
    return row ?? null;
  }

  async activeUserIdsWithCapability(capability: Capability): Promise<string[]> {
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .innerJoin(roleCapabilities, eq(roleCapabilities.role, users.role))
      .where(and(eq(roleCapabilities.capability, capability), eq(users.status, 'active')));
    return rows.map((row) => row.id);
  }

  async resolve(requestId: string, expectedVersion: number, resolution: ReassignmentResolution) {
    const rows = await this.db
      .update(taskReassignmentRequests)
      .set({
        status: resolution.status,
        decidedByUserId: resolution.decidedByUserId,
        decidedAt: resolution.at,
        decisionNote: resolution.note,
        newOwnerUserId: resolution.newOwnerUserId,
        version: sql`${taskReassignmentRequests.version} + 1`,
        updatedAt: resolution.at,
      })
      .where(
        and(
          eq(taskReassignmentRequests.id, requestId),
          eq(taskReassignmentRequests.version, expectedVersion),
          eq(taskReassignmentRequests.status, 'open'),
        ),
      )
      .returning({ id: taskReassignmentRequests.id });
    return rows.length > 0;
  }
}
