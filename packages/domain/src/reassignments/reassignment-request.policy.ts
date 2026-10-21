import { isOpenTaskStatus, TASK_STATUS_LABELS, type TaskStatus } from '../tasks/task-status';

/**
 * A request to hand a task to someone else. "open" waits for the project
 * manager; the other states are final.
 */
export const REASSIGNMENT_STATUSES = ['open', 'accepted', 'declined', 'withdrawn'] as const;
export type ReassignmentStatus = (typeof REASSIGNMENT_STATUSES)[number];

export const REASSIGNMENT_DECISIONS = ['accepted', 'declined'] as const;
export type ReassignmentDecision = (typeof REASSIGNMENT_DECISIONS)[number];

/**
 * Why a step is refused, so callers can answer precisely: not your call
 * (forbidden), already settled (conflict), the input needs work (invalid,
 * with the field), or the task no longer allows it (closed).
 */
export type ReassignmentProblem = 'forbidden' | 'conflict' | 'invalid' | 'closed';

export type ReassignmentCheck =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly problem: ReassignmentProblem;
      readonly reason: string;
      readonly field?: string;
    };

const allow: ReassignmentCheck = { allowed: true };
function refuse(problem: ReassignmentProblem, reason: string, field?: string): ReassignmentCheck {
  return field ? { allowed: false, problem, reason, field } : { allowed: false, problem, reason };
}

/** Shortest reason or note that still tells the other person something. */
export const MIN_REASSIGNMENT_TEXT = 3;

export interface ReassignmentRequestFacts {
  readonly taskStatus: TaskStatus;
  readonly ownerUserId: string | null;
  readonly collaboratorUserIds: readonly string[];
  readonly hasOpenRequest: boolean;
}

export interface ReassignmentAsk {
  readonly requesterUserId: string;
  readonly reason: string;
  readonly suggestedUserId: string | null;
}

/**
 * The owner of a task, or someone working on it with them, may ask the
 * project manager to give it to someone else: one open request per task,
 * for open work only, with a reason.
 */
export function checkReassignmentRequest(
  facts: ReassignmentRequestFacts,
  ask: ReassignmentAsk,
): ReassignmentCheck {
  const isOwner = facts.ownerUserId !== null && facts.ownerUserId === ask.requesterUserId;
  if (!isOwner && !facts.collaboratorUserIds.includes(ask.requesterUserId)) {
    return refuse(
      'forbidden',
      'Only the task owner or a collaborator can ask for it to be reassigned.',
    );
  }
  if (!isOpenTaskStatus(facts.taskStatus)) {
    return refuse('closed', `This task is ${TASK_STATUS_LABELS[facts.taskStatus].toLowerCase()}.`);
  }
  if (facts.hasOpenRequest) {
    return refuse(
      'conflict',
      'A reassignment request for this task is already waiting for a decision.',
    );
  }
  if (ask.reason.trim().length < MIN_REASSIGNMENT_TEXT) {
    return refuse('invalid', 'Say why the task should move to someone else.', 'reason');
  }
  if (ask.suggestedUserId !== null && ask.suggestedUserId === facts.ownerUserId) {
    return refuse('invalid', 'Suggest someone other than the current owner.', 'suggestedUserId');
  }
  return allow;
}

export interface ReassignmentDecisionFacts {
  readonly status: ReassignmentStatus;
  readonly requestedByUserId: string;
  readonly currentOwnerUserId: string | null;
  readonly taskStatus: TaskStatus;
}

export interface ReassignmentRuling {
  readonly deciderUserId: string;
  /** Project manager of the task's project, or someone who manages every project. */
  readonly deciderManagesProject: boolean;
  readonly decision: ReassignmentDecision;
  readonly newOwnerUserId: string | null;
  readonly note: string | null;
}

const FINAL_WORDS: Readonly<Record<Exclude<ReassignmentStatus, 'open'>, string>> = {
  accepted: 'accepted',
  declined: 'declined',
  withdrawn: 'withdrawn',
};

/**
 * Only someone who manages the project decides, never the person who asked
 * (no self-approval). Accepting names the new owner; declining explains why.
 */
export function checkReassignmentDecision(
  facts: ReassignmentDecisionFacts,
  ruling: ReassignmentRuling,
): ReassignmentCheck {
  if (facts.status !== 'open') {
    return refuse('conflict', `This request was already ${FINAL_WORDS[facts.status]}.`);
  }
  if (facts.requestedByUserId === ruling.deciderUserId) {
    return refuse('forbidden', 'Someone else must decide on a request you made.');
  }
  if (!ruling.deciderManagesProject) {
    return refuse('forbidden', 'Only the project manager can decide on a reassignment request.');
  }
  if (ruling.decision === 'declined') {
    return (ruling.note ?? '').trim().length >= MIN_REASSIGNMENT_TEXT
      ? allow
      : refuse('invalid', 'Say why, so the person who asked knows what to do next.', 'note');
  }
  if (!isOpenTaskStatus(facts.taskStatus)) {
    return refuse(
      'closed',
      `The task is ${TASK_STATUS_LABELS[facts.taskStatus].toLowerCase()}; decline instead.`,
    );
  }
  if (ruling.newOwnerUserId === null) {
    return refuse('invalid', 'Choose who should own the task now.', 'newOwnerUserId');
  }
  if (ruling.newOwnerUserId === facts.currentOwnerUserId) {
    return refuse('invalid', 'Choose someone other than the current owner.', 'newOwnerUserId');
  }
  return allow;
}

/** The person who asked may take an open request back. */
export function checkReassignmentWithdrawal(
  facts: Pick<ReassignmentDecisionFacts, 'status' | 'requestedByUserId'>,
  actorUserId: string,
): ReassignmentCheck {
  if (facts.status !== 'open') {
    return refuse('conflict', `This request was already ${FINAL_WORDS[facts.status]}.`);
  }
  if (facts.requestedByUserId !== actorUserId) {
    return refuse('forbidden', 'Only the person who asked can withdraw the request.');
  }
  return allow;
}
