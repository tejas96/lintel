import type { InstantRange } from '@lintel/application';
import { and, eq, gte, inArray, lt, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { projects, taskDateChangeRequests, taskReassignmentRequests, tasks } from '../../schema';
import type { NamedDecisionFact } from './approval-facts';

type RequestTable = typeof taskDateChangeRequests | typeof taskReassignmentRequests;

/**
 * Requests about one task on the scoped projects, of either table: accepted
 * or declined in the window, or still open. Withdrawn ones were never
 * decided, so they are not facts. The record they point at is the task.
 */
async function taskRequestFacts(
  db: DatabaseExecutor,
  table: RequestTable,
  kind: 'date_change' | 'reassignment',
  projectIds: readonly string[],
  window: InstantRange,
): Promise<NamedDecisionFact[]> {
  if (projectIds.length === 0) return [];
  const rows = await db
    .select({
      id: table.id,
      taskId: table.taskId,
      projectId: table.projectId,
      status: table.status,
      createdAt: table.createdAt,
      decidedAt: table.decidedAt,
      decidedByUserId: table.decidedByUserId,
      title: tasks.title,
      reference: projects.reference,
    })
    .from(table)
    .innerJoin(tasks, eq(tasks.id, table.taskId))
    .innerJoin(projects, eq(projects.id, table.projectId))
    .where(
      and(
        inArray(table.projectId, [...projectIds]),
        or(
          and(
            inArray(table.status, ['accepted', 'declined']),
            gte(table.decidedAt, window.from),
            lt(table.decidedAt, window.to),
          ),
          eq(table.status, 'open'),
        ),
      ),
    );
  return rows.map((row) => {
    const waiting = row.status === 'open';
    return {
      kind,
      id: row.id,
      recordId: row.taskId,
      projectId: row.projectId,
      title: row.title,
      context: row.reference,
      requestedAt: row.createdAt,
      decidedAt: waiting ? null : row.decidedAt,
      deciderUserId: waiting ? null : row.decidedByUserId,
    };
  });
}

/** New-date requests: asked until accepted or declined. */
export function dateChangeFacts(
  db: DatabaseExecutor,
  projectIds: readonly string[],
  window: InstantRange,
): Promise<NamedDecisionFact[]> {
  return taskRequestFacts(db, taskDateChangeRequests, 'date_change', projectIds, window);
}

/** Handover (reassignment) requests: asked until accepted or declined. */
export function reassignmentFacts(
  db: DatabaseExecutor,
  projectIds: readonly string[],
  window: InstantRange,
): Promise<NamedDecisionFact[]> {
  return taskRequestFacts(db, taskReassignmentRequests, 'reassignment', projectIds, window);
}
