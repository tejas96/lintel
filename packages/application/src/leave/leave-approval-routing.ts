import { isLegalLeaveTransition, type LeaveStatus } from '@lintel/domain';
import { InvalidTransitionError } from '@lintel/shared';
import type { ApproverDirectory, LeaveStepRecord, NewLeaveStep } from './leave.store';

export interface ApprovalRequester {
  readonly id: string;
  /** The person's manager, or null when they report to nobody (or the manager is inactive). */
  readonly activeManagerUserId: string | null;
}

function firstDelegate(directory: ApproverDirectory, exclude: readonly (string | null)[]) {
  return directory.delegateUserIds.find((candidate) => !exclude.includes(candidate)) ?? null;
}

/**
 * Level 1 is the requester's manager, or the owner when there is none. Level 2
 * (when the policy asks for it) is the owner, or an administrator holding
 * `leave.approve_any` when the owner already approves at level 1 or is the
 * requester. Nobody is routed their own request while someone else can decide.
 */
export function planApprovalSteps(
  requester: ApprovalRequester,
  approvalLevels: 1 | 2,
  directory: ApproverDirectory,
): NewLeaveStep[] {
  let levelOne = requester.activeManagerUserId ?? directory.ownerUserId;
  if (levelOne === null || levelOne === requester.id) {
    levelOne = firstDelegate(directory, [requester.id]) ?? levelOne;
  }
  const steps: NewLeaveStep[] = [{ level: 1, approverUserId: levelOne, status: 'pending' }];
  if (approvalLevels === 1) return steps;
  const owner = directory.ownerUserId;
  const levelTwo =
    owner !== null && owner !== requester.id && owner !== levelOne
      ? owner
      : firstDelegate(directory, [requester.id, levelOne]);
  steps.push(
    levelTwo === null
      ? {
          level: 2,
          approverUserId: null,
          status: 'skipped',
          note: 'No separate second approver is available.',
        }
      : { level: 2, approverUserId: levelTwo, status: 'waiting' },
  );
  return steps;
}

/** The step that is waiting for a decision now: the lowest pending level. */
export function currentStep(steps: readonly LeaveStepRecord[]): LeaveStepRecord | null {
  const pending = steps
    .filter((step) => step.status === 'pending')
    .sort((left, right) => left.level - right.level);
  return pending[0] ?? null;
}

/** The next step after `level` that is still waiting its turn. */
export function nextWaitingStep(
  steps: readonly LeaveStepRecord[],
  level: number,
): LeaveStepRecord | null {
  const waiting = steps
    .filter((step) => step.level > level && step.status === 'waiting')
    .sort((left, right) => left.level - right.level);
  return waiting[0] ?? null;
}

/** Steps that never got their turn once a request is rejected or cancelled. */
export function unfinishedSteps(steps: readonly LeaveStepRecord[]): LeaveStepRecord[] {
  return steps.filter((step) => step.status === 'pending' || step.status === 'waiting');
}

export type LeaveDecision = 'approve' | 'reject' | 'request_info';

export interface LeaveDecisionOutcome {
  readonly requestStatus: LeaveStatus;
  /** The step decided now, when there is one. */
  readonly decidedStep: LeaveStepRecord | null;
  readonly decidedStepStatus: 'approved' | 'rejected' | null;
  /** The next level that becomes pending after an approval. */
  readonly activatedStep: LeaveStepRecord | null;
  /** Later steps that will never get their turn. */
  readonly skippedSteps: readonly LeaveStepRecord[];
}

/**
 * Applies a decision to the approval chain: approving advances to the next
 * level or approves the request, rejecting closes every open step, and asking
 * for information pauses the request with the current step still pending.
 */
export function resolveLeaveDecision(
  status: LeaveStatus,
  steps: readonly LeaveStepRecord[],
  decision: LeaveDecision,
): LeaveDecisionOutcome {
  const step = currentStep(steps);
  if (decision === 'reject') {
    if (!isLegalLeaveTransition(status, 'rejected')) {
      throw new InvalidTransitionError('This request can no longer be rejected.');
    }
    return {
      requestStatus: 'rejected',
      decidedStep: step,
      decidedStepStatus: step ? 'rejected' : null,
      activatedStep: null,
      skippedSteps: unfinishedSteps(steps).filter((candidate) => candidate.id !== step?.id),
    };
  }
  if (status !== 'pending') {
    throw new InvalidTransitionError(
      status === 'info_requested'
        ? 'Waiting for the requester to answer the question first.'
        : 'This request has already been decided.',
    );
  }
  if (decision === 'request_info') {
    return {
      requestStatus: 'info_requested',
      decidedStep: null,
      decidedStepStatus: null,
      activatedStep: null,
      skippedSteps: [],
    };
  }
  const next = step ? nextWaitingStep(steps, step.level) : null;
  return {
    requestStatus: next ? 'pending' : 'approved',
    decidedStep: step,
    decidedStepStatus: step ? 'approved' : null,
    activatedStep: next,
    skippedSteps: [],
  };
}
