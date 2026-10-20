import type {
  LeaveHandoverRecord,
  LeavePeriodRecord,
  LeaveRequestRecord,
  LeaveStepRecord,
  LeaveTypeRecord,
} from '@lintel/application';
import type { CalendarDate } from '@lintel/shared';
import { asc, eq, inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import {
  leaveApprovalSteps,
  leaveHandovers,
  leaveRequests,
  leaveTypes,
  projects,
  tasks,
} from '../schema';

export function toLeaveType(row: typeof leaveTypes.$inferSelect): LeaveTypeRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    colorIndex: row.colorIndex,
    isActive: row.isActive,
    requiresReason: row.requiresReason,
    allowsHalfDay: row.allowsHalfDay,
    minimumNoticeDays: row.minimumNoticeDays,
    annualAllowanceHalfDays: row.annualAllowanceHalfDays,
  };
}

export function toLeavePeriod(row: typeof leaveRequests.$inferSelect): LeavePeriodRecord {
  return {
    id: row.id,
    userId: row.userId,
    leaveTypeId: row.leaveTypeId,
    startDate: row.startDate as CalendarDate,
    endDate: row.endDate as CalendarDate,
    dayPortion: row.dayPortion,
    halfDayUnits: row.halfDayUnits,
    status: row.status,
  };
}

export const handoverColumns = {
  id: leaveHandovers.id,
  leaveRequestId: leaveHandovers.leaveRequestId,
  taskId: leaveHandovers.taskId,
  taskTitle: tasks.title,
  projectId: tasks.projectId,
  projectManagerUserId: projects.managerUserId,
  toUserId: leaveHandovers.toUserId,
  status: leaveHandovers.status,
};

export async function loadHandovers(
  db: DatabaseExecutor,
  requestIds: readonly string[],
): Promise<LeaveHandoverRecord[]> {
  if (requestIds.length === 0) return [];
  return db
    .select(handoverColumns)
    .from(leaveHandovers)
    .innerJoin(tasks, eq(tasks.id, leaveHandovers.taskId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(inArray(leaveHandovers.leaveRequestId, [...requestIds]))
    .orderBy(asc(leaveHandovers.createdAt));
}

/** A leave request with its approval steps (by level) and handovers. */
export async function loadLeaveRequestRecord(
  db: DatabaseExecutor,
  requestId: string,
): Promise<LeaveRequestRecord | null> {
  const [row] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, requestId));
  if (!row) return null;
  // Sequential: commands call this inside a transaction, on one connection.
  const steps = await db
    .select({
      id: leaveApprovalSteps.id,
      level: leaveApprovalSteps.level,
      approverUserId: leaveApprovalSteps.approverUserId,
      status: leaveApprovalSteps.status,
    })
    .from(leaveApprovalSteps)
    .where(eq(leaveApprovalSteps.leaveRequestId, requestId))
    .orderBy(asc(leaveApprovalSteps.level));
  const handovers = await loadHandovers(db, [requestId]);
  return {
    ...toLeavePeriod(row),
    reason: row.reason,
    isUrgentAbsence: row.isUrgentAbsence,
    recordedByUserId: row.recordedByUserId,
    version: row.version,
    steps: steps satisfies LeaveStepRecord[],
    handovers,
  };
}
