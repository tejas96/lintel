import type { DecisionFact, InstantRange } from '@lintel/application';
import { and, eq, gte, inArray, isNotNull, lt, ne, or } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { DatabaseExecutor } from '../../client';
import {
  deliverables,
  deliverableVersions,
  leaveApprovalSteps,
  leaveRequests,
  leaveTypes,
  projects,
  scopeChangeRequests,
  users,
} from '../../schema';

/** A decision fact with what the report needs to name and link it. */
export interface NamedDecisionFact extends DecisionFact {
  readonly recordId: string;
  readonly projectId: string | null;
  readonly title: string;
  readonly context: string | null;
}

const decidedInWindow = (decidedAt: AnyPgColumn, window: InstantRange) =>
  and(gte(decidedAt, window.from), lt(decidedAt, window.to));

/** Reviews of submitted versions on the scoped projects: decided in the window, or waiting now. */
export async function deliverableReviewFacts(
  db: DatabaseExecutor,
  projectIds: readonly string[],
  window: InstantRange,
): Promise<NamedDecisionFact[]> {
  if (projectIds.length === 0) return [];
  const rows = await db
    .select({
      id: deliverableVersions.id,
      deliverableId: deliverables.id,
      name: deliverables.name,
      versionNumber: deliverableVersions.versionNumber,
      submittedAt: deliverableVersions.submittedAt,
      reviewedAt: deliverableVersions.reviewedAt,
      reviewedByUserId: deliverableVersions.reviewedByUserId,
      decision: deliverableVersions.decision,
      projectId: deliverables.projectId,
      reference: projects.reference,
    })
    .from(deliverableVersions)
    .innerJoin(deliverables, eq(deliverables.id, deliverableVersions.deliverableId))
    .innerJoin(projects, eq(projects.id, deliverables.projectId))
    .where(
      and(
        inArray(deliverables.projectId, [...projectIds]),
        or(
          and(
            ne(deliverableVersions.decision, 'pending'),
            decidedInWindow(deliverableVersions.reviewedAt, window),
          ),
          and(
            eq(deliverableVersions.decision, 'pending'),
            eq(deliverables.status, 'in_review'),
            eq(deliverableVersions.versionNumber, deliverables.currentVersionNumber),
          ),
        ),
      ),
    );
  return rows.map((row) => ({
    kind: 'deliverable_review',
    id: row.id,
    recordId: row.deliverableId,
    projectId: row.projectId,
    title: row.name,
    context: `${row.reference} · version ${row.versionNumber}`,
    requestedAt: row.submittedAt,
    decidedAt: row.decision === 'pending' ? null : row.reviewedAt,
    deciderUserId: row.decision === 'pending' ? null : row.reviewedByUserId,
  }));
}

/** Scope changes on the scoped projects: approved or rejected in the window, or still proposed. */
export async function scopeChangeFacts(
  db: DatabaseExecutor,
  projectIds: readonly string[],
  window: InstantRange,
): Promise<NamedDecisionFact[]> {
  if (projectIds.length === 0) return [];
  const rows = await db
    .select({ change: scopeChangeRequests, reference: projects.reference })
    .from(scopeChangeRequests)
    .innerJoin(projects, eq(projects.id, scopeChangeRequests.projectId))
    .where(
      and(
        inArray(scopeChangeRequests.projectId, [...projectIds]),
        or(
          and(
            inArray(scopeChangeRequests.status, ['approved', 'rejected']),
            decidedInWindow(scopeChangeRequests.decidedAt, window),
          ),
          eq(scopeChangeRequests.status, 'proposed'),
        ),
      ),
    );
  return rows.map(({ change, reference }) => ({
    kind: 'scope_change',
    id: change.id,
    recordId: change.id,
    projectId: change.projectId,
    title: change.title,
    context: reference,
    requestedAt: change.createdAt,
    decidedAt: change.status === 'proposed' ? null : change.decidedAt,
    deciderUserId: change.status === 'proposed' ? null : change.decidedByUserId,
  }));
}

/**
 * Leave requests of the given people (null = everyone): finally approved or
 * rejected in the window, or still waiting (pending or asked for more
 * information). Urgent absences are recorded, not requested, so they are left
 * out. The decider is whoever made the final decision.
 */
export async function leaveDecisionFacts(
  db: DatabaseExecutor,
  people: readonly string[] | null,
  window: InstantRange,
): Promise<NamedDecisionFact[]> {
  if (people !== null && people.length === 0) return [];
  const rows = await db
    .select({
      request: leaveRequests,
      typeName: leaveTypes.name,
      requesterName: users.fullName,
    })
    .from(leaveRequests)
    .innerJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.leaveTypeId))
    .innerJoin(users, eq(users.id, leaveRequests.userId))
    .where(
      and(
        eq(leaveRequests.isUrgentAbsence, false),
        people ? inArray(leaveRequests.userId, [...people]) : undefined,
        or(
          and(
            inArray(leaveRequests.status, ['approved', 'rejected']),
            decidedInWindow(leaveRequests.decidedAt, window),
          ),
          inArray(leaveRequests.status, ['pending', 'info_requested']),
        ),
      ),
    );
  const decidedIds = rows
    .filter((row) => row.request.decidedAt !== null)
    .map((row) => row.request.id);
  const steps =
    decidedIds.length === 0
      ? []
      : await db
          .select({
            requestId: leaveApprovalSteps.leaveRequestId,
            decidedBy: leaveApprovalSteps.decidedByUserId,
            decidedAt: leaveApprovalSteps.decidedAt,
          })
          .from(leaveApprovalSteps)
          .where(
            and(
              inArray(leaveApprovalSteps.leaveRequestId, decidedIds),
              inArray(leaveApprovalSteps.status, ['approved', 'rejected']),
              isNotNull(leaveApprovalSteps.decidedAt),
            ),
          );
  const finalDecider = (requestId: string) =>
    steps
      .filter((step) => step.requestId === requestId)
      .sort(
        (left, right) => (right.decidedAt?.getTime() ?? 0) - (left.decidedAt?.getTime() ?? 0),
      )[0]?.decidedBy ?? null;
  return rows.map(({ request, typeName, requesterName }) => {
    const waiting = request.status === 'pending' || request.status === 'info_requested';
    return {
      kind: 'leave_decision',
      id: request.id,
      recordId: request.id,
      projectId: null,
      title: requesterName,
      context: typeName,
      requestedAt: request.createdAt,
      decidedAt: waiting ? null : request.decidedAt,
      deciderUserId: waiting ? null : finalDecider(request.id),
    };
  });
}
