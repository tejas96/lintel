import { describe, expect, it } from 'vitest';
import {
  checkReassignmentDecision,
  checkReassignmentRequest,
  checkReassignmentWithdrawal,
  type ReassignmentDecisionFacts,
  type ReassignmentRequestFacts,
  type ReassignmentRuling,
} from './reassignment-request.policy';

const task: ReassignmentRequestFacts = {
  taskStatus: 'in_progress',
  ownerUserId: 'meera',
  collaboratorUserIds: ['kabir'],
  hasOpenRequest: false,
};
const ask = { requesterUserId: 'meera', reason: 'On site all week', suggestedUserId: 'kabir' };

describe('asking for a reassignment', () => {
  it('lets the owner or a collaborator ask, with a reason', () => {
    expect(checkReassignmentRequest(task, ask)).toEqual({ allowed: true });
    expect(checkReassignmentRequest(task, { ...ask, requesterUserId: 'kabir' })).toEqual({
      allowed: true,
    });
  });

  it('refuses people who do not work on the task', () => {
    const result = checkReassignmentRequest(task, { ...ask, requesterUserId: 'rohan' });
    expect(result.allowed).toBe(false);
  });

  it('allows one open request per task', () => {
    const result = checkReassignmentRequest({ ...task, hasOpenRequest: true }, ask);
    expect(result).toMatchObject({
      allowed: false,
      problem: 'conflict',
      reason: 'A reassignment request for this task is already waiting for a decision.',
    });
  });

  it('refuses closed tasks, empty reasons and suggesting the current owner', () => {
    expect(checkReassignmentRequest({ ...task, taskStatus: 'done' }, ask)).toMatchObject({
      allowed: false,
      reason: 'This task is done.',
    });
    expect(checkReassignmentRequest(task, { ...ask, reason: ' ' }).allowed).toBe(false);
    expect(checkReassignmentRequest(task, { ...ask, suggestedUserId: 'meera' }).allowed).toBe(
      false,
    );
  });
});

describe('deciding on a reassignment', () => {
  const open: ReassignmentDecisionFacts = {
    status: 'open',
    requestedByUserId: 'meera',
    currentOwnerUserId: 'meera',
    taskStatus: 'ready',
  };
  const accept: ReassignmentRuling = {
    deciderUserId: 'pm',
    deciderManagesProject: true,
    decision: 'accepted',
    newOwnerUserId: 'kabir',
    note: null,
  };

  it('lets the project manager accept with a new owner', () => {
    expect(checkReassignmentDecision(open, accept)).toEqual({ allowed: true });
  });

  it('never lets someone decide their own request, even a manager', () => {
    const own = { ...open, requestedByUserId: 'pm', currentOwnerUserId: 'pm' };
    expect(checkReassignmentDecision(own, accept)).toMatchObject({
      allowed: false,
      problem: 'forbidden',
      reason: 'Someone else must decide on a request you made.',
    });
  });

  it('refuses people who do not manage the project', () => {
    const result = checkReassignmentDecision(open, {
      ...accept,
      deciderUserId: 'kabir',
      deciderManagesProject: false,
    });
    expect(result.allowed).toBe(false);
  });

  it('needs a new owner other than the current one to accept', () => {
    expect(checkReassignmentDecision(open, { ...accept, newOwnerUserId: null }).allowed).toBe(
      false,
    );
    expect(checkReassignmentDecision(open, { ...accept, newOwnerUserId: 'meera' }).allowed).toBe(
      false,
    );
  });

  it('needs a note to decline, and can decline after the task closed', () => {
    const decline = { ...accept, decision: 'declined' as const, newOwnerUserId: null };
    expect(checkReassignmentDecision(open, decline).allowed).toBe(false);
    expect(
      checkReassignmentDecision({ ...open, taskStatus: 'done' }, { ...decline, note: 'Finished' }),
    ).toEqual({ allowed: true });
    expect(checkReassignmentDecision({ ...open, taskStatus: 'done' }, accept).allowed).toBe(false);
  });

  it('decides each request only once', () => {
    expect(checkReassignmentDecision({ ...open, status: 'accepted' }, accept)).toMatchObject({
      allowed: false,
      reason: 'This request was already accepted.',
    });
  });
});

describe('withdrawing a reassignment request', () => {
  it('lets only the person who asked withdraw an open request', () => {
    const facts = { status: 'open' as const, requestedByUserId: 'meera' };
    expect(checkReassignmentWithdrawal(facts, 'meera')).toEqual({ allowed: true });
    expect(checkReassignmentWithdrawal(facts, 'pm').allowed).toBe(false);
    expect(checkReassignmentWithdrawal({ ...facts, status: 'declined' }, 'meera').allowed).toBe(
      false,
    );
  });
});
