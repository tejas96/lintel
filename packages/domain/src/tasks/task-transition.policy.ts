import { isLegalTaskTransition, TASK_STATUS_LABELS, type TaskStatus } from './task-status';

/** How the actor relates to the task. Computed on the server, never sent by clients. */
export interface TaskActorRelation {
  readonly isTaskOwner: boolean;
  readonly isCollaborator: boolean;
  readonly isReviewer: boolean;
  /** Project manager of the task's project, or holder of `tasks.manage_any`. */
  readonly canManage: boolean;
}

export interface TaskTransitionContext {
  readonly from: TaskStatus;
  readonly to: TaskStatus;
  readonly actor: TaskActorRelation;
  readonly hasOwner: boolean;
  readonly hasDueDate: boolean;
  readonly requiresReview: boolean;
  readonly hasReviewer: boolean;
  readonly unmetPrerequisiteTitles: readonly string[];
  readonly incompleteRequiredChecklistItems: number;
  readonly missingRequiredDeliverables: readonly string[];
  readonly hasOpenBlockers: boolean;
  /** A short reason typed by the actor. Required for some moves. */
  readonly note: string | null;
}

export interface TransitionViolation {
  readonly code: string;
  readonly message: string;
}

export type TransitionDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly violations: readonly TransitionViolation[] };

type Guard = (context: TaskTransitionContext) => TransitionViolation | null;

const requireOwnerAndDueDate: Guard = (context) =>
  context.hasOwner && context.hasDueDate
    ? null
    : { code: 'OWNER_AND_DUE_DATE_REQUIRED', message: 'Set an owner and a due date first.' };

const requireWorker: Guard = ({ actor }) =>
  actor.isTaskOwner || actor.isCollaborator || actor.canManage
    ? null
    : { code: 'NOT_A_TASK_PARTICIPANT', message: 'Only the owner or a collaborator can do this.' };

const requireOwnerOrManager: Guard = ({ actor }) =>
  actor.isTaskOwner || actor.canManage
    ? null
    : { code: 'OWNER_OR_MANAGER_ONLY', message: 'Only the task owner or a manager can do this.' };

const requireManager: Guard = ({ actor }) =>
  actor.canManage ? null : { code: 'MANAGER_ONLY', message: 'Only a project manager can do this.' };

const requireReviewerOrManager: Guard = ({ actor }) =>
  actor.isReviewer || actor.canManage
    ? null
    : { code: 'REVIEWER_ONLY', message: 'Only the reviewer or a manager can decide on this.' };

const requirePrerequisitesDone: Guard = ({ unmetPrerequisiteTitles }) =>
  unmetPrerequisiteTitles.length === 0
    ? null
    : {
        code: 'WAITING_ON_DEPENDENCIES',
        message: `Waiting on: ${unmetPrerequisiteTitles.join(', ')}.`,
      };

const requireChecklistComplete: Guard = ({ incompleteRequiredChecklistItems }) =>
  incompleteRequiredChecklistItems === 0
    ? null
    : {
        code: 'CHECKLIST_INCOMPLETE',
        message: `${incompleteRequiredChecklistItems} required checklist item(s) are not done.`,
      };

const requireDeliverablesSubmitted: Guard = ({ missingRequiredDeliverables }) =>
  missingRequiredDeliverables.length === 0
    ? null
    : {
        code: 'DELIVERABLES_MISSING',
        message: `Submit the required deliverables: ${missingRequiredDeliverables.join(', ')}.`,
      };

const requireNote: Guard = ({ note }) =>
  note !== null && note.trim().length >= 3
    ? null
    : { code: 'NOTE_REQUIRED', message: 'Add a short note that explains why.' };

const requireNoOpenBlockers: Guard = ({ hasOpenBlockers }) =>
  hasOpenBlockers
    ? { code: 'BLOCKERS_OPEN', message: 'Resolve the open blockers before resuming work.' }
    : null;

const requireReviewSetup: Guard = ({ requiresReview, hasReviewer }) => {
  if (!requiresReview) {
    return { code: 'REVIEW_NOT_REQUIRED', message: 'This task does not need a review step.' };
  }
  return hasReviewer ? null : { code: 'REVIEWER_REQUIRED', message: 'Assign a reviewer first.' };
};

function guardsFor(context: TaskTransitionContext): Guard[] {
  const { from, to } = context;
  if (to === 'cancelled') return [requireManager, requireNote];
  if (from === 'cancelled') return [requireManager];
  if (from === 'done') return [requireManager, requireNote];
  switch (to) {
    case 'draft':
      return [requireManager];
    case 'ready':
      return from === 'draft' ? [requireOwnerOrManager, requireOwnerAndDueDate] : [requireWorker];
    case 'in_progress':
      if (from === 'blocked') return [requireWorker, requireNoOpenBlockers];
      if (from === 'in_review') return [requireOwnerOrManager];
      return [requireWorker, requireOwnerAndDueDate, requirePrerequisitesDone];
    case 'blocked':
      return [requireWorker, requireNote];
    case 'in_review':
      return [
        requireOwnerOrManager,
        requireReviewSetup,
        requireChecklistComplete,
        requireDeliverablesSubmitted,
      ];
    case 'changes_requested':
      return [requireReviewerOrManager, requireNote];
    case 'done':
      if (from === 'in_review') return [requireReviewerOrManager];
      return [
        requireOwnerOrManager,
        ({ requiresReview }) =>
          requiresReview
            ? { code: 'REVIEW_REQUIRED', message: 'Send this task for review instead.' }
            : null,
        requireChecklistComplete,
        requireDeliverablesSubmitted,
      ];
    default:
      return [];
  }
}

/** Decides whether a status change is allowed, and explains every reason it is not. */
export function decideTaskTransition(context: TaskTransitionContext): TransitionDecision {
  if (!isLegalTaskTransition(context.from, context.to)) {
    const from = TASK_STATUS_LABELS[context.from];
    const to = TASK_STATUS_LABELS[context.to];
    return {
      allowed: false,
      violations: [
        { code: 'ILLEGAL_TRANSITION', message: `A task cannot move from ${from} to ${to}.` },
      ],
    };
  }
  const violations = guardsFor(context)
    .map((guard) => guard(context))
    .filter((violation): violation is TransitionViolation => violation !== null);
  return violations.length === 0 ? { allowed: true } : { allowed: false, violations };
}
