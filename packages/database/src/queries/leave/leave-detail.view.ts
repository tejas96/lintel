import type { LeaveImpact, LeaveRequestAccess } from '@lintel/application';
import { eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { leaveRequests } from '../../schema';
import { loadUserSummaries } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';
import { type LeaveHandoverView, loadLeaveHandoverViews } from './leave-handover.view';
import {
  type LeaveRequestView,
  type LeaveViewer,
  loadLeaveRequestViews,
} from './leave-request.view';

export interface LeaveImpactView {
  readonly days: { date: string; halfDayUnits: number }[];
  readonly halfDayUnits: number;
  readonly durationLabel: string;
  readonly conflicts: {
    taskId: string;
    title: string;
    projectName: string;
    kind: 'due_during_leave' | 'work_during_leave' | 'milestone_during_leave';
    severity: 'critical' | 'warning';
    explanation: string;
  }[];
  readonly overlappingAbsences: { user: UserSummaryView; status: string; dates: string[] }[];
  readonly warnings: string[];
  readonly blockingProblems: string[];
  readonly approvalLevels: number;
}

export interface LeaveRequestDetailView extends LeaveRequestView {
  readonly impact: LeaveImpactView;
  readonly handovers: LeaveHandoverView[];
  readonly viewerCanDecide: boolean;
  readonly viewerCanCancel: boolean;
}

/** Shapes an impact assessment for the API, resolving overlapping colleagues to summaries. */
export async function toLeaveImpactView(
  db: DatabaseExecutor,
  impact: LeaveImpact,
): Promise<LeaveImpactView> {
  const people = await loadUserSummaries(
    db,
    impact.overlappingAbsences.map((absence) => absence.userId),
  );
  return {
    days: impact.days.map((day) => ({ date: day.date, halfDayUnits: day.halfDayUnits })),
    halfDayUnits: impact.halfDayUnits,
    durationLabel: impact.durationLabel,
    conflicts: impact.conflicts.map((conflict) => ({
      taskId: conflict.taskId,
      title: conflict.title,
      projectName: conflict.projectName,
      kind: conflict.kind,
      severity: conflict.severity,
      explanation: conflict.explanation,
    })),
    overlappingAbsences: impact.overlappingAbsences.flatMap((absence) => {
      const user = people.get(absence.userId);
      return user ? [{ user, status: absence.status, dates: [...absence.dates] }] : [];
    }),
    warnings: [...impact.warnings],
    blockingProblems: [...impact.blockingProblems],
    approvalLevels: impact.approvalLevels,
  };
}

/**
 * The detail view: the request, its live impact, handovers (read against each
 * task's current owner) and what the viewer may do. The reason and notes are
 * included only when the access check allowed this viewer to read them.
 */
export async function loadLeaveRequestDetail(
  db: DatabaseExecutor,
  access: LeaveRequestAccess,
  viewer: LeaveViewer,
): Promise<LeaveRequestDetailView | null> {
  const [view] = await loadLeaveRequestViews(db, {
    ...(access.viewerCanSeeReason ? { viewer } : {}),
    where: eq(leaveRequests.id, access.request.id),
  });
  if (!view) return null;
  const [impact, handovers] = await Promise.all([
    toLeaveImpactView(db, access.impact),
    loadLeaveHandoverViews(db, access.request),
  ]);
  return {
    ...view,
    impact,
    handovers,
    viewerCanDecide: access.viewerCanDecide,
    viewerCanCancel: access.viewerCanCancel,
  };
}
