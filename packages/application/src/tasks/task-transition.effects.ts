import { domainEvent, unmetPrerequisites } from '@lintel/domain';
import type { RequestContext } from '../common/request-context';
import type { Notifier } from '../notifications/notifier';
import type { OperationsStores } from './operations-context';
import type { ProjectTaskNode, TaskRecord } from './task.store';
import { isFinishedTaskStatus } from './task-decision';
import { notifyAboutTask, quoted, type TaskNotice } from './task-records';

export interface TransitionOutcome {
  readonly context: RequestContext;
  readonly before: TaskRecord;
  readonly after: TaskRecord;
  readonly note: string | null;
}

/** Ready tasks whose last unfinished prerequisite was the task that just finished. */
export function newlyStartableDependents(
  finishedTaskId: string,
  graph: {
    edges: readonly { taskId: string; dependsOnTaskId: string }[];
    nodes: ProjectTaskNode[];
  },
): ProjectTaskNode[] {
  const statusOf = new Map(graph.nodes.map((node) => [node.id, node.status]));
  const isFinished = (id: string) => {
    if (id === finishedTaskId) return true;
    const status = statusOf.get(id);
    return status !== undefined && isFinishedTaskStatus(status);
  };
  const dependentIds = new Set(
    graph.edges.filter((edge) => edge.dependsOnTaskId === finishedTaskId).map((e) => e.taskId),
  );
  return graph.nodes.filter(
    (node) =>
      dependentIds.has(node.id) &&
      node.status === 'ready' &&
      unmetPrerequisites(node.id, graph.edges, isFinished).length === 0,
  );
}

async function notifyStartableDependents(
  stores: OperationsStores,
  notifier: Notifier,
  outcome: TransitionOutcome,
): Promise<void> {
  const { after, context } = outcome;
  const graph = await stores.tasks.dependencyGraph(after.projectId);
  for (const dependent of newlyStartableDependents(after.id, graph)) {
    await notifyAboutTask(notifier, context.actor.userId, dependent, `unblocked-by:${after.id}`, [
      {
        kind: 'blocker_resolved',
        recipientUserId: dependent.ownerUserId,
        title: `${quoted(dependent.title)} can start now`,
        body: `${quoted(after.title)} is done, so nothing it waits on is left open.`,
      },
    ]);
  }
}

function noticesFor(outcome: TransitionOutcome): TaskNotice[] {
  const { before, after, note } = outcome;
  const name = quoted(after.title);
  switch (after.status) {
    case 'in_review':
      return [
        {
          kind: 'review_requested',
          recipientUserId: after.reviewerUserId,
          title: `Review requested: ${name}`,
          body: 'The task was submitted for your review.',
        },
      ];
    case 'changes_requested':
      return [
        {
          kind: 'review_decided',
          recipientUserId: after.ownerUserId,
          title: `Changes requested on ${name}`,
          body: note ?? 'The reviewer asked for changes.',
        },
      ];
    case 'done':
      return before.status === 'in_review'
        ? [
            {
              kind: 'review_decided',
              recipientUserId: after.ownerUserId,
              title: `${name} was approved`,
              body: note ?? 'The reviewer approved the work and the task is done.',
            },
          ]
        : [];
    case 'ready':
      return before.status === 'draft'
        ? [
            {
              kind: 'task_assigned',
              recipientUserId: after.ownerUserId,
              title: `New task: ${name}`,
              body: after.dueDate ? `Due ${after.dueDate}.` : 'A task was assigned to you.',
            },
          ]
        : [];
    default:
      return [];
  }
}

/** Notifications and outbox events that follow a status change. */
export async function applyTransitionEffects(
  stores: OperationsStores,
  notifier: Notifier,
  outcome: TransitionOutcome,
): Promise<void> {
  const { after, before, context } = outcome;
  const actorId = context.actor.userId;
  await notifyAboutTask(notifier, actorId, after, `v${after.version}`, noticesFor(outcome));
  const projectId = after.projectId;
  if (after.status === 'in_review') {
    await stores.records.enqueueEvent(
      domainEvent('TaskSubmittedForReview', 'task', after.id, {
        taskId: after.id,
        projectId,
        reviewerId: after.reviewerUserId,
      }),
    );
  }
  if (after.status === 'done') {
    await stores.records.enqueueEvent(
      domainEvent('TaskCompleted', 'task', after.id, {
        taskId: after.id,
        projectId,
        completedBy: actorId,
      }),
    );
    await notifyStartableDependents(stores, notifier, outcome);
  }
  if (after.status === 'ready' && before.status === 'draft' && after.ownerUserId) {
    await stores.records.enqueueEvent(
      domainEvent('TaskAssigned', 'task', after.id, {
        taskId: after.id,
        projectId,
        ownerId: after.ownerUserId,
        assignedBy: actorId,
      }),
    );
  }
}
