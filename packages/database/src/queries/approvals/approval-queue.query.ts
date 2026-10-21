import { type Capability, formatLeaveDuration } from '@lintel/domain';
import { type CalendarDate, daysBetween, toCalendarDate } from '@lintel/shared';
import { and, asc, eq, exists, ne, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import {
  leaveApprovalSteps,
  leaveRequests,
  leaveTypes,
  projects,
  rewardEvaluations,
  rewardPolicies,
  scopeChangeRequests,
  teams,
  users,
} from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { ProjectRefView, UserSummaryView } from '../shared/view-types';
import { reassignmentApprovals } from './approval-sources.reassignments';
import {
  type ApprovalDraft,
  deliverableReviews,
  isStale,
  priorityConflictReviews,
  projectRefColumns,
  SOURCE_LIMIT,
  taskReviews,
} from './approval-sources.work';

export interface ApprovalItemView {
  readonly type: ApprovalDraft['type'];
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly requestedBy: UserSummaryView | null;
  readonly requestedAt: string;
  readonly project: ProjectRefView | null;
  readonly linkPath: string;
  readonly urgency: 'normal' | 'high';
}

export interface ApprovalViewer {
  readonly userId: string;
  readonly capabilities: ReadonlySet<Capability>;
}

/** Leave starting within this many days is urgent to decide. */
const LEAVE_URGENT_DAYS = 3;

/** Leave steps pending for me, or every pending request when I hold `leave.approve_any`. */
async function leaveApprovals(
  db: DatabaseExecutor,
  viewer: ApprovalViewer,
  today: CalendarDate,
): Promise<ApprovalDraft[]> {
  const mine = exists(
    db
      .select({ id: leaveApprovalSteps.id })
      .from(leaveApprovalSteps)
      .where(
        and(
          eq(leaveApprovalSteps.leaveRequestId, leaveRequests.id),
          eq(leaveApprovalSteps.approverUserId, viewer.userId),
          eq(leaveApprovalSteps.status, 'pending'),
        ),
      ),
  );
  const rows = await db
    .select({ request: leaveRequests, typeName: leaveTypes.name, fullName: users.fullName })
    .from(leaveRequests)
    .innerJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.leaveTypeId))
    .innerJoin(users, eq(users.id, leaveRequests.userId))
    .where(
      and(
        eq(leaveRequests.status, 'pending'),
        viewer.capabilities.has('leave.approve_any')
          ? or(mine, ne(leaveRequests.userId, viewer.userId))
          : mine,
      ),
    )
    .orderBy(asc(leaveRequests.startDate))
    .limit(SOURCE_LIMIT);
  return rows.map(({ request, typeName, fullName }) => ({
    type: 'leave_request',
    id: request.id,
    title: `${fullName} · ${typeName}`,
    subtitle: `${request.startDate} to ${request.endDate} · ${formatLeaveDuration(request.halfDayUnits)}`,
    requestedByUserId: request.userId,
    requestedAt: request.createdAt,
    project: null,
    linkPath: `/leave/${request.id}`,
    urgency:
      daysBetween(today, toCalendarDate(request.startDate)) <= LEAVE_URGENT_DAYS
        ? 'high'
        : 'normal',
  }));
}

async function scopeChangeApprovals(
  db: DatabaseExecutor,
  today: CalendarDate,
): Promise<ApprovalDraft[]> {
  const rows = await db
    .select({ change: scopeChangeRequests, project: projectRefColumns })
    .from(scopeChangeRequests)
    .innerJoin(projects, eq(projects.id, scopeChangeRequests.projectId))
    .where(eq(scopeChangeRequests.status, 'proposed'))
    .orderBy(asc(scopeChangeRequests.createdAt))
    .limit(SOURCE_LIMIT);
  return rows.map(({ change, project }) => ({
    type: 'scope_change',
    id: change.id,
    title: change.title,
    subtitle: `Scope change · ${project.name}`,
    requestedByUserId: change.requestedByUserId,
    requestedAt: change.createdAt,
    project,
    linkPath: `/projects/${project.id}?tab=scope`,
    urgency: isStale(change.createdAt, today) ? 'high' : 'normal',
  }));
}

async function rewardApprovals(db: DatabaseExecutor): Promise<ApprovalDraft[]> {
  const rows = await db
    .select({
      evaluation: rewardEvaluations,
      policyName: rewardPolicies.name,
      personName: users.fullName,
      teamName: teams.name,
    })
    .from(rewardEvaluations)
    .innerJoin(rewardPolicies, eq(rewardPolicies.id, rewardEvaluations.policyId))
    .leftJoin(users, eq(users.id, rewardEvaluations.userId))
    .leftJoin(teams, eq(teams.id, rewardEvaluations.teamId))
    .where(eq(rewardEvaluations.status, 'pending_review'))
    .orderBy(asc(rewardEvaluations.periodStart), asc(rewardEvaluations.createdAt))
    .limit(SOURCE_LIMIT);
  return rows.map(({ evaluation, policyName, personName, teamName }) => ({
    type: 'reward_review',
    id: evaluation.id,
    title: policyName,
    subtitle: `${personName ?? teamName ?? 'Unknown'} · ${evaluation.periodStart} to ${evaluation.periodEnd}`,
    requestedByUserId: null,
    requestedAt: evaluation.updatedAt,
    project: null,
    linkPath: '/rewards',
    urgency: 'normal',
  }));
}

/**
 * Everything waiting for the viewer's decision, urgent first and then oldest
 * first. Shared by `/me/approvals` and the command center.
 */
export async function loadApprovalQueue(
  db: DatabaseExecutor,
  viewer: ApprovalViewer,
  today: CalendarDate,
): Promise<ApprovalItemView[]> {
  const can = (capability: Capability) => viewer.capabilities.has(capability);
  const none = Promise.resolve<ApprovalDraft[]>([]);
  const sources = await Promise.all([
    deliverableReviews(db, viewer.userId, today),
    taskReviews(db, viewer.userId, today),
    leaveApprovals(db, viewer, today),
    can('scope_changes.approve') ? scopeChangeApprovals(db, today) : none,
    can('rewards.decide') ? rewardApprovals(db) : none,
    priorityConflictReviews(db, viewer.userId),
    reassignmentApprovals(db, viewer, today),
  ]);
  const drafts = sources
    .flat()
    .sort(
      (left, right) =>
        (left.urgency === 'high' ? 0 : 1) - (right.urgency === 'high' ? 0 : 1) ||
        left.requestedAt.getTime() - right.requestedAt.getTime(),
    );
  const people = await loadUserSummaries(
    db,
    drafts.map((draft) => draft.requestedByUserId),
  );
  return drafts.map(({ requestedByUserId, requestedAt, ...draft }) => ({
    ...draft,
    requestedBy: pickUser(people, requestedByUserId),
    requestedAt: requestedAt.toISOString(),
  }));
}
