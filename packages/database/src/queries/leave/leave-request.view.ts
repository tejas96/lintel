import { type DayPortion, formatLeaveDuration, type LeaveStatus } from '@lintel/domain';
import { asc, desc, eq, inArray, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { leaveApprovalSteps, leaveHandovers, leaveRequests, leaveTypes, tasks } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { TaskRefView, UserSummaryView } from '../shared/view-types';

export interface LeaveStepView {
  readonly level: number;
  readonly approver: UserSummaryView | null;
  readonly status: 'waiting' | 'pending' | 'approved' | 'rejected' | 'skipped';
  readonly note: string | null;
  readonly decidedAt: string | null;
}

export interface LeaveRequestView {
  readonly id: string;
  readonly user: UserSummaryView;
  readonly leaveType: { id: string; code: string; name: string; colorIndex: number };
  readonly startDate: string;
  readonly endDate: string;
  readonly dayPortion: DayPortion;
  readonly halfDayUnits: number;
  readonly durationLabel: string;
  readonly reason: string | null;
  readonly status: LeaveStatus;
  readonly isUrgentAbsence: boolean;
  readonly warnings: string[];
  readonly steps: LeaveStepView[];
  readonly decisionNote: string | null;
  readonly createdAt: string;
  readonly version: number;
}

export interface LeaveHandoverView {
  readonly id: string;
  readonly task: TaskRefView;
  readonly to: UserSummaryView | null;
  readonly note: string | null;
  readonly status: 'proposed' | 'accepted' | 'declined' | 'applied';
}

const MISSING_PERSON: UserSummaryView = {
  id: '00000000-0000-0000-0000-000000000000',
  fullName: 'Unknown',
  designation: null,
  role: 'employee',
  avatarHue: 0,
  status: 'deactivated',
};

export interface LeaveViewQuery {
  readonly where?: SQL | undefined;
  readonly orderBy?: SQL[];
  readonly limit?: number;
  readonly offset?: number;
}

/** The one way to build LeaveRequest views (lists, detail, approvals, dashboard). */
export async function loadLeaveRequestViews(
  db: DatabaseExecutor,
  query: LeaveViewQuery,
): Promise<LeaveRequestView[]> {
  const rows = await db
    .select({
      request: leaveRequests,
      leaveType: {
        id: leaveTypes.id,
        code: leaveTypes.code,
        name: leaveTypes.name,
        colorIndex: leaveTypes.colorIndex,
      },
    })
    .from(leaveRequests)
    .innerJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.leaveTypeId))
    .where(query.where)
    .orderBy(...(query.orderBy ?? [desc(leaveRequests.startDate)]))
    .limit(query.limit ?? 100)
    .offset(query.offset ?? 0);
  if (rows.length === 0) return [];
  const steps = await db
    .select()
    .from(leaveApprovalSteps)
    .where(
      inArray(
        leaveApprovalSteps.leaveRequestId,
        rows.map((row) => row.request.id),
      ),
    )
    .orderBy(asc(leaveApprovalSteps.level));
  const people = await loadUserSummaries(db, [
    ...rows.map((row) => row.request.userId),
    ...steps.map((step) => step.approverUserId),
  ]);
  return rows.map(({ request, leaveType }) => ({
    id: request.id,
    user: people.get(request.userId) ?? MISSING_PERSON,
    leaveType,
    startDate: request.startDate,
    endDate: request.endDate,
    dayPortion: request.dayPortion,
    halfDayUnits: request.halfDayUnits,
    durationLabel: formatLeaveDuration(request.halfDayUnits),
    reason: request.reason,
    status: request.status,
    isUrgentAbsence: request.isUrgentAbsence,
    warnings: request.warnings,
    steps: steps
      .filter((step) => step.leaveRequestId === request.id)
      .map((step) => ({
        level: step.level,
        approver: pickUser(people, step.approverUserId),
        status: step.status,
        note: step.note,
        decidedAt: step.decidedAt?.toISOString() ?? null,
      })),
    decisionNote: request.decisionNote,
    createdAt: request.createdAt.toISOString(),
    version: request.version,
  }));
}

export async function loadLeaveHandoverViews(
  db: DatabaseExecutor,
  requestId: string,
): Promise<LeaveHandoverView[]> {
  const rows = await db
    .select({
      id: leaveHandovers.id,
      note: leaveHandovers.note,
      status: leaveHandovers.status,
      toUserId: leaveHandovers.toUserId,
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
    .where(eq(leaveHandovers.leaveRequestId, requestId))
    .orderBy(asc(leaveHandovers.createdAt));
  const people = await loadUserSummaries(
    db,
    rows.map((row) => row.toUserId),
  );
  return rows.map(({ toUserId, ...row }) => ({ ...row, to: pickUser(people, toUserId) }));
}
