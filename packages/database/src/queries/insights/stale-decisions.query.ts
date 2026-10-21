import { DECISION_GRACE_HOURS } from '@lintel/domain';
import { and, count, eq, inArray, lt } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import {
  deliverables,
  deliverableVersions,
  leaveRequests,
  scopeChangeRequests,
  taskDateChangeRequests,
  taskReassignmentRequests,
  tasks,
} from '../../schema';
import type { CommandCenterScope } from '../operations/command-center/command-center-scope';

async function total(query: Promise<{ total: number }[]>): Promise<number> {
  const [row] = await query;
  return row?.total ?? 0;
}

/**
 * Decisions waiting longer than the grace time (48 hours) in the view:
 * submitted task reviews and deliverable versions, scope changes, handover
 * and new-date requests on scoped projects, and leave of people in scope.
 */
export async function countStaleDecisions(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
  now: Date,
): Promise<number> {
  const before = new Date(now.getTime() - DECISION_GRACE_HOURS * 3_600_000);
  const projectIds = scope.projectIds;
  const parts: Promise<number>[] = [];
  if (projectIds.length > 0) {
    parts.push(
      total(
        db
          .select({ total: count() })
          .from(tasks)
          .where(
            and(
              inArray(tasks.projectId, projectIds),
              eq(tasks.status, 'in_review'),
              lt(tasks.submittedAt, before),
            ),
          ),
      ),
      total(
        db
          .select({ total: count() })
          .from(deliverableVersions)
          .innerJoin(deliverables, eq(deliverables.id, deliverableVersions.deliverableId))
          .where(
            and(
              inArray(deliverables.projectId, projectIds),
              eq(deliverableVersions.decision, 'pending'),
              eq(deliverables.status, 'in_review'),
              lt(deliverableVersions.submittedAt, before),
            ),
          ),
      ),
      total(
        db
          .select({ total: count() })
          .from(scopeChangeRequests)
          .where(
            and(
              inArray(scopeChangeRequests.projectId, projectIds),
              eq(scopeChangeRequests.status, 'proposed'),
              lt(scopeChangeRequests.createdAt, before),
            ),
          ),
      ),
      total(
        db
          .select({ total: count() })
          .from(taskReassignmentRequests)
          .where(
            and(
              inArray(taskReassignmentRequests.projectId, projectIds),
              eq(taskReassignmentRequests.status, 'open'),
              lt(taskReassignmentRequests.createdAt, before),
            ),
          ),
      ),
      total(
        db
          .select({ total: count() })
          .from(taskDateChangeRequests)
          .where(
            and(
              inArray(taskDateChangeRequests.projectId, projectIds),
              eq(taskDateChangeRequests.status, 'open'),
              lt(taskDateChangeRequests.createdAt, before),
            ),
          ),
      ),
    );
  }
  if (scope.peopleIds.length > 0) {
    parts.push(
      total(
        db
          .select({ total: count() })
          .from(leaveRequests)
          .where(
            and(
              inArray(leaveRequests.userId, scope.peopleIds),
              inArray(leaveRequests.status, ['pending', 'info_requested']),
              lt(leaveRequests.createdAt, before),
            ),
          ),
      ),
    );
  }
  const counts = await Promise.all(parts);
  return counts.reduce((sum, value) => sum + value, 0);
}
