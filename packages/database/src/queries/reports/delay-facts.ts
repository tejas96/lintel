import { type DelayFact, type InstantRange, signoffReadyAt } from '@lintel/application';
import { toCalendarDate } from '@lintel/shared';
import { and, eq, gte, inArray, isNull, lt, notInArray, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { milestones, projects, taskBlockers, tasks } from '../../schema';
import { deliverableReviewFacts } from './approval-facts';

/** A wait with what the report needs to name and link it. */
export interface NamedDelayFact extends DelayFact {
  /** Milestone, task (client wait) or deliverable (internal review). */
  readonly recordId: string;
  readonly title: string;
  readonly context: string | null;
}

const CLOSED_TASK = ['done', 'cancelled'] as const;

/**
 * Client sign-offs on the scoped projects: milestones that need the client's
 * approval, completed in the window, or still pending with all their tasks
 * closed (done or cancelled) and ready by now. The wait starts at the latest
 * completion of their done tasks, or 00:00 on the due date without one.
 */
export async function clientSignoffFacts(
  db: DatabaseExecutor,
  projectIds: readonly string[],
  window: InstantRange,
  sources: { readonly timeZone: string; readonly now: Date },
): Promise<NamedDelayFact[]> {
  if (projectIds.length === 0) return [];
  const rows = await db
    .select({ milestone: milestones, reference: projects.reference })
    .from(milestones)
    .innerJoin(projects, eq(projects.id, milestones.projectId))
    .where(
      and(
        inArray(milestones.projectId, [...projectIds]),
        eq(milestones.requiresClientApproval, true),
        or(
          and(
            eq(milestones.status, 'completed'),
            gte(milestones.completedAt, window.from),
            lt(milestones.completedAt, window.to),
          ),
          eq(milestones.status, 'pending'),
        ),
      ),
    );
  const milestoneIds = rows.map((row) => row.milestone.id);
  const work =
    milestoneIds.length === 0
      ? []
      : await db
          .select({
            milestoneId: tasks.milestoneId,
            status: tasks.status,
            completedAt: tasks.completedAt,
          })
          .from(tasks)
          .where(and(inArray(tasks.milestoneId, milestoneIds), isNull(tasks.archivedAt)));
  return rows.flatMap(({ milestone, reference }): NamedDelayFact[] => {
    const own = work.filter((task) => task.milestoneId === milestone.id);
    const done = own.flatMap((task) =>
      task.status === 'done' && task.completedAt ? [task.completedAt] : [],
    );
    const readyAt = signoffReadyAt(done, toCalendarDate(milestone.dueDate), sources.timeZone);
    const pending = milestone.status === 'pending';
    if (pending) {
      const allClosed = own.every((task) =>
        (CLOSED_TASK as readonly string[]).includes(task.status),
      );
      if (!allClosed || readyAt > sources.now) return [];
    } else if (!milestone.completedAt) {
      return [];
    }
    return [
      {
        kind: 'client_signoff',
        id: milestone.id,
        recordId: milestone.id,
        projectId: milestone.projectId,
        title: milestone.name,
        context: reference,
        readyAt,
        resolvedAt: pending ? null : milestone.completedAt,
      },
    ];
  });
}

/**
 * Tasks blocked on the client on the scoped projects (archived tasks left
 * out): blockers resolved in the window, or still open on a task that is not
 * done or cancelled. The wait runs from raised to resolved.
 */
export async function clientWaitFacts(
  db: DatabaseExecutor,
  projectIds: readonly string[],
  window: InstantRange,
): Promise<NamedDelayFact[]> {
  if (projectIds.length === 0) return [];
  const rows = await db
    .select({
      id: taskBlockers.id,
      raisedAt: taskBlockers.raisedAt,
      resolvedAt: taskBlockers.resolvedAt,
      taskId: tasks.id,
      number: tasks.number,
      title: tasks.title,
      projectId: tasks.projectId,
      reference: projects.reference,
    })
    .from(taskBlockers)
    .innerJoin(tasks, eq(tasks.id, taskBlockers.taskId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(
        inArray(tasks.projectId, [...projectIds]),
        isNull(tasks.archivedAt),
        eq(taskBlockers.category, 'client'),
        or(
          and(gte(taskBlockers.resolvedAt, window.from), lt(taskBlockers.resolvedAt, window.to)),
          and(isNull(taskBlockers.resolvedAt), notInArray(tasks.status, [...CLOSED_TASK])),
        ),
      ),
    );
  return rows.map((row) => ({
    kind: 'client_wait',
    id: row.id,
    recordId: row.taskId,
    projectId: row.projectId,
    title: row.title,
    context: `${row.reference} · #${row.number}`,
    readyAt: row.raisedAt,
    resolvedAt: row.resolvedAt,
  }));
}

/** Internal reviews: versions decided in the window, or the current version still waiting. */
export async function internalReviewFacts(
  db: DatabaseExecutor,
  projectIds: readonly string[],
  window: InstantRange,
): Promise<NamedDelayFact[]> {
  const reviews = await deliverableReviewFacts(db, projectIds, window);
  return reviews.flatMap((review): NamedDelayFact[] =>
    review.projectId
      ? [
          {
            kind: 'internal_review',
            id: review.id,
            recordId: review.recordId,
            projectId: review.projectId,
            title: review.title,
            context: review.context,
            readyAt: review.requestedAt,
            resolvedAt: review.decidedAt,
          },
        ]
      : [],
  );
}
