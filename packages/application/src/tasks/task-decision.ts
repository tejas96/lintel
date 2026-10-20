import {
  type Actor,
  decideTaskTransition,
  TASK_TRANSITIONS,
  type TaskActorRelation,
  type TaskStatus,
  type TransitionDecision,
  type TransitionViolation,
  unmetPrerequisites,
} from '@lintel/domain';
import {
  type ApplicationError,
  ForbiddenError,
  InvalidTransitionError,
  PreconditionFailedError,
  ValidationFailedError,
} from '@lintel/shared';
import type { ProjectAccess } from '../access/project-access.service';
import type { TaskDecisionInputs, TaskRecord } from './task.store';

/** Everything the transition rules need about one task and one viewer, computed on the server. */
export interface TaskDecisionFacts {
  readonly task: TaskRecord;
  readonly relation: TaskActorRelation;
  readonly collaboratorUserIds: readonly string[];
  readonly unmetPrerequisiteTitles: readonly string[];
  readonly incompleteRequiredChecklistItems: number;
  readonly missingRequiredDeliverables: readonly string[];
  readonly hasOpenBlockers: boolean;
}

export interface TransitionOptionView {
  readonly to: TaskStatus;
  readonly label: string;
  readonly allowed: boolean;
  readonly requiresNote: boolean;
  readonly reasons: string[];
}

/** A prerequisite stops blocking once it is done or was cancelled. */
export function isFinishedTaskStatus(status: TaskStatus): boolean {
  return status === 'done' || status === 'cancelled';
}

export function taskActorRelation(
  actor: Actor,
  task: Pick<TaskRecord, 'ownerUserId' | 'reviewerUserId'>,
  collaboratorUserIds: readonly string[],
  access: Pick<ProjectAccess, 'canManage'>,
): TaskActorRelation {
  return {
    isTaskOwner: task.ownerUserId !== null && task.ownerUserId === actor.userId,
    isCollaborator: collaboratorUserIds.includes(actor.userId),
    isReviewer: task.reviewerUserId !== null && task.reviewerUserId === actor.userId,
    canManage: access.canManage || actor.capabilities.has('tasks.manage_any'),
  };
}

export function buildDecisionFacts(
  task: TaskRecord,
  inputs: TaskDecisionInputs,
  relation: TaskActorRelation,
): TaskDecisionFacts {
  const statusById = new Map(inputs.prerequisites.map((item) => [item.id, item.status]));
  const titleById = new Map(inputs.prerequisites.map((item) => [item.id, item.title]));
  const unmet = unmetPrerequisites(task.id, inputs.prerequisiteEdges, (id) => {
    const status = statusById.get(id);
    return status !== undefined && isFinishedTaskStatus(status);
  });
  return {
    task,
    relation,
    collaboratorUserIds: inputs.collaboratorUserIds,
    unmetPrerequisiteTitles: unmet.map((id) => titleById.get(id) ?? 'an earlier task'),
    incompleteRequiredChecklistItems: inputs.checklist.filter(
      (item) => item.isRequired && !item.completed,
    ).length,
    missingRequiredDeliverables: inputs.deliverables
      .filter(
        (item) => item.isRequired && item.status !== 'cancelled' && item.currentVersionNumber === 0,
      )
      .map((item) => item.name),
    hasOpenBlockers: inputs.openBlockerCount > 0,
  };
}

export function decideFor(
  facts: TaskDecisionFacts,
  to: TaskStatus,
  note: string | null,
): TransitionDecision {
  const { task } = facts;
  return decideTaskTransition({
    from: task.status,
    to,
    actor: facts.relation,
    hasOwner: task.ownerUserId !== null,
    hasDueDate: task.dueDate !== null,
    requiresReview: task.requiresReview,
    hasReviewer: task.reviewerUserId !== null,
    unmetPrerequisiteTitles: facts.unmetPrerequisiteTitles,
    incompleteRequiredChecklistItems: facts.incompleteRequiredChecklistItems,
    missingRequiredDeliverables: facts.missingRequiredDeliverables,
    hasOpenBlockers: facts.hasOpenBlockers,
    note,
  });
}

const NOTE_REQUIRED = 'NOTE_REQUIRED';

/** A short action label for a move, as shown on buttons. */
export function transitionLabel(from: TaskStatus, to: TaskStatus): string {
  switch (to) {
    case 'ready':
      return from === 'draft' ? 'Publish' : 'Move back to ready';
    case 'in_progress':
      if (from === 'ready') return 'Start work';
      if (from === 'in_review') return 'Withdraw from review';
      if (from === 'done') return 'Reopen';
      return 'Resume work';
    case 'blocked':
      return 'Report blocker';
    case 'in_review':
      return 'Submit for review';
    case 'changes_requested':
      return 'Request changes';
    case 'done':
      return from === 'in_review' ? 'Approve and complete' : 'Mark done';
    case 'cancelled':
      return 'Cancel task';
    case 'draft':
      return from === 'cancelled' ? 'Restore as draft' : 'Move back to draft';
  }
}

/**
 * Every legal next status with whether the viewer may choose it now and, if
 * not, every reason. A note requirement is reported separately because the
 * viewer can satisfy it while making the move.
 */
export function transitionOptions(facts: TaskDecisionFacts): TransitionOptionView[] {
  const from = facts.task.status;
  return TASK_TRANSITIONS[from].map((to) => {
    const decision = decideFor(facts, to, null);
    const violations = decision.allowed ? [] : decision.violations;
    const blocking = violations.filter((violation) => violation.code !== NOTE_REQUIRED);
    return {
      to,
      label: transitionLabel(from, to),
      allowed: blocking.length === 0,
      requiresNote: violations.some((violation) => violation.code === NOTE_REQUIRED),
      reasons: blocking.map((violation) => violation.message),
    };
  });
}

const PERMISSION_CODES = new Set([
  'NOT_A_TASK_PARTICIPANT',
  'OWNER_OR_MANAGER_ONLY',
  'MANAGER_ONLY',
  'REVIEWER_ONLY',
]);

/** Maps refused moves to API errors: illegal 422, not yours 403, missing note 400, otherwise 422. */
export function transitionRefusal(violations: readonly TransitionViolation[]): ApplicationError {
  const message = violations.map((violation) => violation.message).join(' ');
  const details = violations.map((violation) => ({ message: violation.message }));
  if (violations.some((violation) => violation.code === 'ILLEGAL_TRANSITION')) {
    return new InvalidTransitionError(message, details);
  }
  if (violations.some((violation) => PERMISSION_CODES.has(violation.code))) {
    return new ForbiddenError(message);
  }
  if (violations.every((violation) => violation.code === NOTE_REQUIRED)) {
    return new ValidationFailedError(message, [{ field: 'note', message }]);
  }
  return new PreconditionFailedError(message, details);
}

export function assertTransitionAllowed(decision: TransitionDecision): void {
  if (!decision.allowed) throw transitionRefusal(decision.violations);
}
