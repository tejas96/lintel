import type {
  HandoverChange,
  LeaveRequestChange,
  LeaveStepChange,
  LeaveStore,
  NewHandover,
  NewLeaveRequest,
  NewLeaveStep,
  TeamAbsenceRecord,
} from '@lintel/application';
import type { LeaveStatus } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import { and, asc, eq, gte, inArray, lte, ne, or, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import {
  leaveApprovalSteps,
  leaveHandovers,
  leaveRequests,
  leaveTypes,
  projects,
  tasks,
  users,
} from '../schema';
import {
  handoverColumns,
  loadLeaveRequestRecord,
  toLeavePeriod,
  toLeaveType,
} from './leave-request.rows';
import {
  ensureProjectMemberRow,
  loadApproverDirectory,
  loadHandoverTask,
  loadOpenWorkOf,
  reassignTaskOwnerRow,
} from './leave-work.queries';

const overlaps = (start: string, end: string) =>
  and(lte(leaveRequests.startDate, end), gte(leaveRequests.endDate, start));

export class LeaveRepository implements LeaveStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async findLeaveType(leaveTypeId: string) {
    const [row] = await this.db.select().from(leaveTypes).where(eq(leaveTypes.id, leaveTypeId));
    return row ? toLeaveType(row) : null;
  }

  async activeLeaveTypes() {
    const rows = await this.db
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.isActive, true))
      .orderBy(asc(leaveTypes.colorIndex), asc(leaveTypes.name));
    return rows.map(toLeaveType);
  }

  findRequest(requestId: string) {
    return loadLeaveRequestRecord(this.db, requestId);
  }

  async findHandover(handoverId: string) {
    const [row] = await this.db
      .select(handoverColumns)
      .from(leaveHandovers)
      .innerJoin(tasks, eq(tasks.id, leaveHandovers.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(eq(leaveHandovers.id, handoverId));
    return row ?? null;
  }

  async personRequests(
    userId: string,
    range: { start: CalendarDate; end: CalendarDate },
    statuses: readonly LeaveStatus[],
  ) {
    if (statuses.length === 0) return [];
    const rows = await this.db
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.userId, userId),
          inArray(leaveRequests.status, [...statuses]),
          overlaps(range.start, range.end),
        ),
      );
    return rows.map(toLeavePeriod);
  }

  async teamAbsences(input: {
    userId: string;
    teamId: string | null;
    reportsToUserId: string | null;
    start: CalendarDate;
    end: CalendarDate;
  }): Promise<TeamAbsenceRecord[]> {
    const related = [
      input.teamId ? eq(users.teamId, input.teamId) : undefined,
      input.reportsToUserId ? eq(users.reportsToUserId, input.reportsToUserId) : undefined,
    ].filter((condition) => condition !== undefined);
    if (related.length === 0) return [];
    const rows = await this.db
      .select({ request: leaveRequests, fullName: users.fullName })
      .from(leaveRequests)
      .innerJoin(users, eq(users.id, leaveRequests.userId))
      .where(
        and(
          ne(leaveRequests.userId, input.userId),
          or(...related),
          inArray(leaveRequests.status, ['pending', 'info_requested', 'approved']),
          overlaps(input.start, input.end),
        ),
      )
      .orderBy(asc(leaveRequests.startDate));
    return rows.map((row) => ({ ...toLeavePeriod(row.request), fullName: row.fullName }));
  }

  openTasksOf(userId: string) {
    return loadOpenWorkOf(this.db, userId);
  }

  approverDirectory() {
    return loadApproverDirectory(this.db);
  }

  async createRequest(input: NewLeaveRequest) {
    const [row] = await this.db
      .insert(leaveRequests)
      .values({ ...input, warnings: [...input.warnings] })
      .returning({ id: leaveRequests.id });
    if (!row) throw new Error('Creating the leave request returned no row.');
    return row;
  }

  async addSteps(requestId: string, steps: readonly NewLeaveStep[]) {
    if (steps.length === 0) return;
    await this.db
      .insert(leaveApprovalSteps)
      .values(steps.map((step) => ({ ...step, leaveRequestId: requestId })));
  }

  async addHandovers(requestId: string, handovers: readonly NewHandover[]) {
    if (handovers.length === 0) return;
    await this.db
      .insert(leaveHandovers)
      .values(handovers.map((handover) => ({ ...handover, leaveRequestId: requestId })))
      .onConflictDoNothing();
  }

  async removeUnappliedHandovers(requestId: string) {
    await this.db
      .delete(leaveHandovers)
      .where(
        and(eq(leaveHandovers.leaveRequestId, requestId), ne(leaveHandovers.status, 'applied')),
      );
  }

  async updateRequest(requestId: string, expectedVersion: number, change: LeaveRequestChange) {
    const { warnings, ...rest } = change;
    const rows = await this.db
      .update(leaveRequests)
      .set({
        ...rest,
        ...(warnings ? { warnings: [...warnings] } : {}),
        version: sql`${leaveRequests.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(leaveRequests.id, requestId), eq(leaveRequests.version, expectedVersion)))
      .returning({ id: leaveRequests.id });
    return rows.length > 0;
  }

  async updateStep(stepId: string, change: LeaveStepChange) {
    await this.db.update(leaveApprovalSteps).set(change).where(eq(leaveApprovalSteps.id, stepId));
  }

  async updateHandover(handoverId: string, change: HandoverChange) {
    await this.db.update(leaveHandovers).set(change).where(eq(leaveHandovers.id, handoverId));
  }

  handoverTask(taskId: string) {
    return loadHandoverTask(this.db, taskId);
  }

  reassignTaskOwner(taskId: string, expectedVersion: number, ownerUserId: string) {
    return reassignTaskOwnerRow(this.db, taskId, expectedVersion, ownerUserId);
  }

  ensureProjectMember(projectId: string, userId: string) {
    return ensureProjectMemberRow(this.db, projectId, userId);
  }
}
