import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import {
  checkDateChangeDecision,
  checkDateChangeRequest,
  checkDateChangeWithdrawal,
  type DateChangeAsk,
  type DateChangeRequestFacts,
} from './date-change-request.policy';

const facts: DateChangeRequestFacts = {
  taskStatus: 'ready',
  ownerUserId: 'meera',
  collaboratorUserIds: ['kabir'],
  currentDueDate: toCalendarDate('2026-10-23'),
  hasOpenRequest: false,
};
const ask: DateChangeAsk = {
  requesterUserId: 'meera',
  reason: 'Waiting for the client brief',
  proposedStartDate: toCalendarDate('2026-10-26'),
  proposedDueDate: toCalendarDate('2026-10-28'),
  today: toCalendarDate('2026-10-21'),
};

describe('asking for a new date', () => {
  it('lets the owner or a collaborator ask, with a reason', () => {
    expect(checkDateChangeRequest(facts, ask)).toEqual({ allowed: true });
    expect(checkDateChangeRequest(facts, { ...ask, requesterUserId: 'kabir' }).allowed).toBe(true);
  });

  it('refuses everyone else and closed or reviewed work', () => {
    expect(checkDateChangeRequest(facts, { ...ask, requesterUserId: 'rohan' })).toMatchObject({
      problem: 'forbidden',
    });
    expect(checkDateChangeRequest({ ...facts, taskStatus: 'in_review' }, ask)).toMatchObject({
      problem: 'closed',
      reason: 'This task is in review.',
    });
    expect(checkDateChangeRequest({ ...facts, taskStatus: 'done' }, ask)).toMatchObject({
      problem: 'closed',
    });
  });

  it('allows one open request per task', () => {
    expect(checkDateChangeRequest({ ...facts, hasOpenRequest: true }, ask)).toMatchObject({
      problem: 'conflict',
    });
  });

  it('checks the reason and the dates', () => {
    expect(checkDateChangeRequest(facts, { ...ask, reason: ' ' })).toMatchObject({
      field: 'reason',
    });
    expect(
      checkDateChangeRequest(facts, { ...ask, proposedDueDate: toCalendarDate('2026-10-20') }),
    ).toMatchObject({ field: 'proposedDueDate', reason: 'Choose a due date from today on.' });
    expect(
      checkDateChangeRequest(facts, { ...ask, proposedDueDate: toCalendarDate('2026-10-23') }),
    ).toMatchObject({ field: 'proposedDueDate' });
    expect(
      checkDateChangeRequest(facts, { ...ask, proposedStartDate: toCalendarDate('2026-10-29') }),
    ).toMatchObject({ field: 'proposedStartDate' });
  });
});

describe('deciding a new-date request', () => {
  const open = {
    status: 'open' as const,
    requestedByUserId: 'meera',
    taskStatus: 'ready' as const,
  };
  const ruling = {
    deciderUserId: 'pm',
    deciderManagesProject: true,
    decision: 'accepted' as const,
    note: null,
  };

  it('lets the project manager accept', () => {
    expect(checkDateChangeDecision(open, ruling)).toEqual({ allowed: true });
  });

  it('never lets someone decide their own request, or a non-manager decide', () => {
    expect(checkDateChangeDecision(open, { ...ruling, deciderUserId: 'meera' })).toMatchObject({
      problem: 'forbidden',
    });
    expect(
      checkDateChangeDecision(open, { ...ruling, deciderManagesProject: false }),
    ).toMatchObject({
      problem: 'forbidden',
    });
  });

  it('needs a note to decline and an open request to decide', () => {
    expect(checkDateChangeDecision(open, { ...ruling, decision: 'declined' })).toMatchObject({
      field: 'note',
    });
    expect(
      checkDateChangeDecision(open, {
        ...ruling,
        decision: 'declined',
        note: 'Client date is fixed',
      }),
    ).toEqual({ allowed: true });
    expect(checkDateChangeDecision({ ...open, status: 'accepted' }, ruling)).toMatchObject({
      problem: 'conflict',
    });
    expect(checkDateChangeDecision({ ...open, taskStatus: 'done' }, ruling)).toMatchObject({
      problem: 'closed',
    });
  });

  it('lets only the person who asked withdraw', () => {
    expect(checkDateChangeWithdrawal(open, 'meera')).toEqual({ allowed: true });
    expect(checkDateChangeWithdrawal(open, 'pm')).toMatchObject({ problem: 'forbidden' });
  });
});
