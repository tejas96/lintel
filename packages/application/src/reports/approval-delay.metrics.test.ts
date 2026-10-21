import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import {
  clientKey,
  compareDelayGroups,
  type DelayFact,
  isDelayed,
  isRecurringDelay,
  signoffReadyAt,
  slowestWaits,
  summarizeDelayGroup,
  summarizeDelays,
  waitHours,
} from './approval-delay.metrics';

const at = (iso: string) => new Date(iso);
const window = { from: at('2026-10-01T00:00:00Z'), to: at('2026-11-01T00:00:00Z') };
const now = at('2026-10-21T12:00:00Z');

function wait(
  id: string,
  ready: string,
  resolved: string | null,
  kind: DelayFact['kind'] = 'client_wait',
): DelayFact {
  return {
    kind,
    id,
    projectId: 'p1',
    readyAt: at(ready),
    resolvedAt: resolved ? at(resolved) : null,
  };
}

describe('approval delay rules', () => {
  it('counts a wait over 48 hours as delayed; exactly 48 hours is not', () => {
    expect(isDelayed(48)).toBe(false);
    expect(isDelayed(48.1)).toBe(true);
    expect(waitHours(wait('a', '2026-10-01T00:00:00Z', '2026-10-03T00:00:00Z'), now)).toBe(48);
  });

  it('never measures a negative wait', () => {
    const early = wait('a', '2026-10-05T10:00:00Z', '2026-10-05T08:00:00Z', 'client_signoff');
    expect(waitHours(early, now)).toBe(0);
  });

  it('flags a client or project with three or more delayed approvals as recurring', () => {
    expect(isRecurringDelay(2)).toBe(false);
    expect(isRecurringDelay(3)).toBe(true);
  });

  it('starts a sign-off wait at the last done task, or at studio midnight on the due date', () => {
    const done = [at('2026-10-02T09:00:00Z'), at('2026-10-04T11:30:00Z')];
    expect(signoffReadyAt(done, toCalendarDate('2026-10-10'), 'Asia/Kolkata').toISOString()).toBe(
      '2026-10-04T11:30:00.000Z',
    );
    expect(signoffReadyAt([], toCalendarDate('2026-10-10'), 'Asia/Kolkata').toISOString()).toBe(
      '2026-10-09T18:30:00.000Z',
    );
  });

  it('groups clients by trimmed, case-insensitive name', () => {
    expect(clientKey('  Mehta Family ')).toBe(clientKey('mehta family'));
  });
});

describe('approval delay summaries', () => {
  const facts = [
    wait('a', '2026-10-01T00:00:00Z', '2026-10-01T10:00:00Z'),
    wait('b', '2026-10-02T00:00:00Z', '2026-10-05T00:00:00Z'),
    wait('c', '2026-10-06T00:00:00Z', '2026-10-08T00:00:00Z'),
    wait('d', '2026-10-08T00:00:00Z', '2026-10-12T00:00:00Z'),
    wait('before', '2026-09-01T00:00:00Z', '2026-09-20T00:00:00Z'),
    wait('open', '2026-10-19T12:00:00Z', null, 'internal_review'),
  ];

  it('summarises waits that ended in the range and what is waiting now', () => {
    expect(summarizeDelays(facts, window, now)).toEqual({
      count: 4,
      delayed: 2,
      medianHours: 60,
      slowestHours: 96,
      waitingNow: 1,
      oldestWaitingHours: 48,
    });
    expect(summarizeDelays([], window, now)).toMatchObject({
      count: 0,
      medianHours: null,
      slowestHours: null,
      oldestWaitingHours: null,
    });
  });

  it('splits a group by kind and orders groups most delayed first', () => {
    const group = summarizeDelayGroup(facts, window, now);
    expect(group.kinds.map((row) => row.kind)).toEqual(['client_wait', 'internal_review']);
    expect(group.recurring).toBe(false);
    const recurring = summarizeDelayGroup(
      [...facts, wait('e', '2026-10-13T00:00:00Z', '2026-10-20T00:00:00Z')],
      window,
      now,
    );
    expect(recurring.recurring).toBe(true);
    expect([group, recurring].sort(compareDelayGroups)[0]).toBe(recurring);
  });

  it('lists the slowest waits that ended in the range', () => {
    expect(slowestWaits(facts, window, now, 2).map((item) => item.fact.id)).toEqual(['d', 'b']);
  });
});
