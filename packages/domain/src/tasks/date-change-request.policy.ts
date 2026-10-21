import type { CalendarDate } from '@lintel/shared';
import type {
  ReassignmentCheck,
  ReassignmentProblem,
} from '../reassignments/reassignment-request.policy';
import { TASK_STATUS_LABELS, type TaskStatus } from './task-status';

/** A request to move a task's dates. "open" waits for the project manager. */
export const DATE_CHANGE_STATUSES = ['open', 'accepted', 'declined', 'withdrawn'] as const;
export type DateChangeStatus = (typeof DATE_CHANGE_STATUSES)[number];

export const DATE_CHANGE_DECISIONS = ['accepted', 'declined'] as const;
export type DateChangeDecision = (typeof DATE_CHANGE_DECISIONS)[number];

/** Same answer shape as reassignment requests: forbidden, conflict, invalid or closed. */
export type DateChangeCheck = ReassignmentCheck;

const allow: DateChangeCheck = { allowed: true };
function refuse(problem: ReassignmentProblem, reason: string, field?: string): DateChangeCheck {
  return field ? { allowed: false, problem, reason, field } : { allowed: false, problem, reason };
}

export const MIN_DATE_CHANGE_TEXT = 3;

/** Statuses in which a new date can still be asked for: the work is open and not in review. */
const REQUESTABLE: readonly TaskStatus[] = [
  'draft',
  'ready',
  'in_progress',
  'blocked',
  'changes_requested',
];

export interface DateChangeRequestFacts {
  readonly taskStatus: TaskStatus;
  readonly ownerUserId: string | null;
  readonly collaboratorUserIds: readonly string[];
  readonly currentDueDate: CalendarDate | null;
  readonly hasOpenRequest: boolean;
}

export interface DateChangeAsk {
  readonly requesterUserId: string;
  readonly reason: string;
  readonly proposedStartDate: CalendarDate | null;
  readonly proposedDueDate: CalendarDate;
  readonly today: CalendarDate;
}

/**
 * The owner of a task, or a collaborator, asks the project manager for a new
 * date: one open request per task, a reason, a due date from today on that
 * differs from the current one, and a start no later than the due date.
 */
export function checkDateChangeRequest(
  facts: DateChangeRequestFacts,
  ask: DateChangeAsk,
): DateChangeCheck {
  const isOwner = facts.ownerUserId !== null && facts.ownerUserId === ask.requesterUserId;
  if (!isOwner && !facts.collaboratorUserIds.includes(ask.requesterUserId)) {
    return refuse('forbidden', 'Only the task owner or a collaborator can ask for a new date.');
  }
  if (!REQUESTABLE.includes(facts.taskStatus)) {
    return refuse('closed', `This task is ${TASK_STATUS_LABELS[facts.taskStatus].toLowerCase()}.`);
  }
  if (facts.hasOpenRequest) {
    return refuse(
      'conflict',
      'A new-date request for this task is already waiting for a decision.',
    );
  }
  if (ask.reason.trim().length < MIN_DATE_CHANGE_TEXT) {
    return refuse('invalid', 'Say why the task needs a new date.', 'reason');
  }
  if (ask.proposedDueDate < ask.today) {
    return refuse('invalid', 'Choose a due date from today on.', 'proposedDueDate');
  }
  if (ask.proposedDueDate === facts.currentDueDate) {
    return refuse('invalid', 'Choose a due date other than the current one.', 'proposedDueDate');
  }
  if (ask.proposedStartDate !== null && ask.proposedStartDate > ask.proposedDueDate) {
    return refuse('invalid', 'The start must be on or before the due date.', 'proposedStartDate');
  }
  return allow;
}

export interface DateChangeDecisionFacts {
  readonly status: DateChangeStatus;
  readonly requestedByUserId: string;
  readonly taskStatus: TaskStatus;
}

export interface DateChangeRuling {
  readonly deciderUserId: string;
  readonly deciderManagesProject: boolean;
  readonly decision: DateChangeDecision;
  readonly note: string | null;
}

/**
 * Only someone who manages the project decides, never the person who asked.
 * Declining explains why; accepting needs the work to still be open.
 */
export function checkDateChangeDecision(
  facts: DateChangeDecisionFacts,
  ruling: DateChangeRuling,
): DateChangeCheck {
  if (facts.status !== 'open') {
    return refuse('conflict', `This request was already ${facts.status}.`);
  }
  if (facts.requestedByUserId === ruling.deciderUserId) {
    return refuse('forbidden', 'Someone else must decide on a request you made.');
  }
  if (!ruling.deciderManagesProject) {
    return refuse('forbidden', 'Only the project manager can decide on a new-date request.');
  }
  if (ruling.decision === 'declined') {
    return (ruling.note ?? '').trim().length >= MIN_DATE_CHANGE_TEXT
      ? allow
      : refuse('invalid', 'Say why, so the person who asked knows what to do next.', 'note');
  }
  if (!REQUESTABLE.includes(facts.taskStatus)) {
    return refuse(
      'closed',
      `The task is ${TASK_STATUS_LABELS[facts.taskStatus].toLowerCase()}; decline instead.`,
    );
  }
  return allow;
}

/** The person who asked may take an open request back. */
export function checkDateChangeWithdrawal(
  facts: Pick<DateChangeDecisionFacts, 'status' | 'requestedByUserId'>,
  actorUserId: string,
): DateChangeCheck {
  if (facts.status !== 'open') {
    return refuse('conflict', `This request was already ${facts.status}.`);
  }
  if (facts.requestedByUserId !== actorUserId) {
    return refuse('forbidden', 'Only the person who asked can withdraw the request.');
  }
  return allow;
}
