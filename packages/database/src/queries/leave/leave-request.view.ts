import { canSeeLeaveReason } from '@lintel/application';
import { type Actor, type DayPortion, formatLeaveDuration, type LeaveStatus } from '@lintel/domain';
import { asc, desc, eq, inArray, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { leaveApprovalSteps, leaveRequests, leaveTypes, users } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';

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

const MISSING_PERSON: UserSummaryView = {
  id: '00000000-0000-0000-0000-000000000000',
  fullName: 'Unknown',
  designation: null,
  role: 'employee',
  avatarHue: 0,
  status: 'deactivated',
};

/** Who reads the views: the reason and notes are left out for people who may not read them. */
export type LeaveViewer = Pick<Actor, 'userId' | 'capabilities'>;

export interface LeaveViewQuery {
  /** Without a viewer every reason and note is left out (dashboards, summaries). */
  readonly viewer?: LeaveViewer;
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
  const requesterIds = [...new Set(rows.map((row) => row.request.userId))];
  const [people, managers] = await Promise.all([
    loadUserSummaries(db, [...requesterIds, ...steps.map((step) => step.approverUserId)]),
    db
      .select({ id: users.id, reportsToUserId: users.reportsToUserId })
      .from(users)
      .where(inArray(users.id, requesterIds)),
  ]);
  const viewer = query.viewer;
  const mayRead = (request: (typeof rows)[number]['request']) =>
    viewer !== undefined &&
    canSeeLeaveReason(viewer, {
      requesterUserId: request.userId,
      requesterManagerUserId:
        managers.find((manager) => manager.id === request.userId)?.reportsToUserId ?? null,
      recordedByUserId: request.recordedByUserId,
      approverUserIds: steps
        .filter((step) => step.leaveRequestId === request.id)
        .map((step) => step.approverUserId),
    });
  return rows.map(({ request, leaveType }) => {
    const personal = mayRead(request);
    return {
      id: request.id,
      user: people.get(request.userId) ?? MISSING_PERSON,
      leaveType,
      startDate: request.startDate,
      endDate: request.endDate,
      dayPortion: request.dayPortion,
      halfDayUnits: request.halfDayUnits,
      durationLabel: formatLeaveDuration(request.halfDayUnits),
      reason: personal ? request.reason : null,
      status: request.status,
      isUrgentAbsence: request.isUrgentAbsence,
      warnings: request.warnings,
      steps: steps
        .filter((step) => step.leaveRequestId === request.id)
        .map((step) => ({
          level: step.level,
          approver: pickUser(people, step.approverUserId),
          status: step.status,
          note: personal ? step.note : null,
          decidedAt: step.decidedAt?.toISOString() ?? null,
        })),
      decisionNote: personal ? request.decisionNote : null,
      createdAt: request.createdAt.toISOString(),
      version: request.version,
    };
  });
}
