import { domainEvent, TASK_STATUS_LABELS } from '@lintel/domain';
import { PreconditionFailedError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import {
  cancelSubtasksByDecision,
  cancelTaskByDecision,
  type DecidedCancellation,
} from '../tasks/cancel-task-by-decision';
import { quoted } from '../tasks/task-records';
import type { ScopeChangeRecord, StoredScopeChangeNewTask } from './scope-change.store';

type Stores = Pick<
  ApplicationStores,
  'scopeChanges' | 'tasks' | 'records' | 'access' | 'workSessions' | 'templateUpdates'
>;

export interface AppliedScopeAdditions {
  /** Tasks created by the approval, with their owners (for notices). */
  readonly created: {
    readonly taskId: string;
    readonly ownerUserId: string | null;
    readonly title: string;
    readonly dueDate: string | null;
  }[];
  /** Tasks the approval cancelled, with their owners. */
  readonly cancelled: { readonly taskId: string; readonly ownerUserId: string | null }[];
}

export interface ApprovedAdditions {
  readonly scopeChange: ScopeChangeRecord;
  readonly note: string;
  readonly decidedByUserId: string;
  readonly at: Date;
  readonly context: RequestContext;
}

/** New work goes into open stages only; a stage that closed since the proposal stops the approval. */
async function assertStagesStillOpen(
  stores: Stores,
  projectId: string,
  additions: readonly StoredScopeChangeNewTask[],
): Promise<void> {
  const stages = await stores.scopeChanges.stagesOf(projectId);
  for (const addition of additions) {
    if (addition.stageId === null) continue;
    const stage = stages.find((candidate) => candidate.id === addition.stageId);
    if (stage?.status === 'pending' || stage?.status === 'active') continue;
    throw new PreconditionFailedError(
      `${stage ? quoted(stage.name) : 'Its stage'} closed after this change was proposed, so ${quoted(addition.title)} cannot be added there. Reject this change and propose it again.`,
    );
  }
}

/** Owners must still be active project members when the change is approved; otherwise the task waits unassigned. */
async function stillOnProject(
  stores: Stores,
  projectId: string,
  userId: string | null,
): Promise<boolean> {
  if (!userId) return false;
  if (!(await stores.tasks.activeUserIds([userId])).has(userId)) return false;
  const facts = await stores.access.accessFacts(projectId, userId);
  return facts.projectRole !== null || facts.managerUserId === userId;
}

/**
 * Creates the tasks an approved scope change adds and cancels the tasks it
 * removes, in the approval's transaction. A task that closed or went to
 * review since the proposal is left as it is, and the reason is kept.
 */
export async function applyScopeAdditions(
  stores: Stores,
  approved: ApprovedAdditions,
): Promise<AppliedScopeAdditions> {
  const { scopeChange } = approved;
  const reason = `Scope change "${scopeChange.title}" approved: ${approved.note}`;
  const created: AppliedScopeAdditions['created'] = [];
  const additions = await stores.scopeChanges.newTasksOf(scopeChange.id);
  await assertStagesStillOpen(stores, scopeChange.projectId, additions);
  for (const addition of additions) {
    const owner = (await stillOnProject(stores, scopeChange.projectId, addition.ownerUserId))
      ? addition.ownerUserId
      : null;
    const ready = owner !== null && addition.dueDate !== null;
    const task = await stores.tasks.create({
      projectId: scopeChange.projectId,
      stageId: addition.stageId,
      milestoneId: null,
      parentTaskId: null,
      title: addition.title,
      description: `Added by scope change "${scopeChange.title}".`,
      status: ready ? 'ready' : 'draft',
      priority: addition.priority,
      ownerUserId: owner,
      reviewerUserId: null,
      plannedStartDate: addition.plannedStartDate,
      dueDate: addition.dueDate,
      baselineDueDate: ready ? addition.dueDate : null,
      estimateMinutes: null,
      requiresReview: false,
      completionCriteria: null,
      createdByUserId: approved.decidedByUserId,
    });
    await stores.scopeChanges.linkCreatedTask(addition.id, task.id);
    await stores.tasks.recordScheduleChange({
      taskId: task.id,
      previousDueDate: null,
      newDueDate: task.dueDate,
      reason,
      changedByUserId: approved.decidedByUserId,
    });
    await stores.records.appendActivity({
      projectId: scopeChange.projectId,
      taskId: task.id,
      actorUserId: approved.decidedByUserId,
      type: 'task.created',
      summary: `Created task #${task.number} “${task.title}” from scope change "${scopeChange.title}".`,
      payload: { scopeChangeId: scopeChange.id, ownerUserId: owner, dueDate: task.dueDate },
    });
    if (ready && owner) {
      await stores.records.enqueueEvent(
        domainEvent('TaskAssigned', 'task', task.id, {
          taskId: task.id,
          projectId: task.projectId,
          ownerId: owner,
          assignedBy: approved.decidedByUserId,
        }),
      );
    }
    created.push({
      taskId: task.id,
      ownerUserId: ready ? owner : null,
      title: task.title,
      dueDate: task.dueDate,
    });
  }
  await extendEndForNewWork(stores, scopeChange.projectId, created);
  return { created, cancelled: await cancelTasks(stores, approved, reason) };
}

/** Approving new work that ends after the planned end moves the planned end (never the baseline). */
async function extendEndForNewWork(
  stores: Stores,
  projectId: string,
  created: AppliedScopeAdditions['created'],
): Promise<void> {
  const latest = created.reduce<string | null>(
    (max, task) => (task.dueDate && (max === null || task.dueDate > max) ? task.dueDate : max),
    null,
  );
  if (!latest) return;
  const facts = await stores.scopeChanges.scheduleFacts(projectId);
  if (facts && latest > facts.plannedEndDate) {
    await stores.scopeChanges.extendProjectEnd(projectId, latest);
  }
}

async function cancelTasks(
  stores: Stores,
  approved: ApprovedAdditions,
  reason: string,
): Promise<AppliedScopeAdditions['cancelled']> {
  const cancelled: AppliedScopeAdditions['cancelled'] = [];
  const decided: DecidedCancellation = {
    context: approved.context,
    reason,
    at: approved.at,
    source: { scopeChangeId: approved.scopeChange.id },
  };
  for (const cancellation of await stores.scopeChanges.cancellationsOf(approved.scopeChange.id)) {
    const task = await stores.tasks.findForUpdate(cancellation.taskId);
    const closed = !task || task.status === 'done' || task.status === 'cancelled';
    if (closed || task.status === 'in_review') {
      const status = task ? TASK_STATUS_LABELS[task.status].toLowerCase() : 'removed';
      await stores.scopeChanges.settleCancellation(cancellation.id, {
        skipReason: closed ? `It was already ${status}.` : 'It was waiting for review.',
      });
      continue;
    }
    if (!(await cancelTaskByDecision(stores, task, decided))) continue;
    const subtaskIds = await stores.templateUpdates.unstartedSubtaskIds(task.id);
    await cancelSubtasksByDecision(stores, subtaskIds, decided);
    await stores.scopeChanges.settleCancellation(cancellation.id, { appliedAt: approved.at });
    cancelled.push({ taskId: task.id, ownerUserId: task.ownerUserId });
  }
  return cancelled;
}
