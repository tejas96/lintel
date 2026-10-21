import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { reportPeriods } from './report-periods';
import {
  buildReworkBreakdown,
  mostSentBack,
  type ReviewOutcomeFact,
  tallyRework,
} from './rework-rate.metrics';

const date = toCalendarDate;

let sequence = 0;
function review(
  decision: ReviewOutcomeFact['decision'],
  extra: Partial<ReviewOutcomeFact> = {},
): ReviewOutcomeFact {
  sequence += 1;
  return {
    versionId: `v${sequence}`,
    deliverableId: 'd1',
    taskId: 't1',
    projectId: 'p1',
    submitterUserId: 'u1',
    reviewedOn: date('2026-10-06'),
    decision,
    ...extra,
  };
}

describe('rework rate', () => {
  it('is "–" (null) when nothing was reviewed', () => {
    expect(tallyRework([])).toEqual({
      reviewed: 0,
      approved: 0,
      changesRequested: 0,
      rejected: 0,
      sentBack: 0,
      reworkRate: null,
    });
  });

  it('counts changes requested and rejected as sent back, over everything reviewed', () => {
    const tally = tallyRework([
      review('approved'),
      review('changes_requested'),
      review('rejected'),
      review('approved'),
      review('approved'),
      review('approved'),
    ]);
    expect(tally).toMatchObject({ reviewed: 6, sentBack: 2, approved: 4, reworkRate: 0.333 });
    expect(tallyRework([review('approved')]).reworkRate).toBe(0);
  });
});

describe('rework breakdown', () => {
  const range = { start: date('2026-10-05'), end: date('2026-10-18') };
  const periods = reportPeriods(range, 'week');

  it('groups by project, submitter, task (or deliverable) and review period', () => {
    const facts = [
      review('changes_requested'),
      review('approved', { reviewedOn: date('2026-10-13') }),
      review('rejected', { taskId: null, deliverableId: 'd9', submitterUserId: 'u2' }),
      review('approved', { projectId: 'p2', submitterUserId: 'u2', taskId: 't2' }),
      review('rejected', { reviewedOn: date('2026-10-02') }),
    ];
    const breakdown = buildReworkBreakdown(facts, periods);
    expect(breakdown.totals).toMatchObject({ reviewed: 4, sentBack: 2, reworkRate: 0.5 });
    expect(breakdown.byPeriod.map((period) => period.reviewed)).toEqual([3, 1]);
    expect(breakdown.byProject.get('p1')).toMatchObject({ reviewed: 3, sentBack: 2 });
    expect(breakdown.bySubmitter.get('u2')).toMatchObject({ reviewed: 2, reworkRate: 0.5 });
    expect(breakdown.bySubject.get('task:t1')).toMatchObject({ reviewed: 2, sentBack: 1 });
    expect(breakdown.bySubject.get('deliverable:d9')?.subject).toEqual({
      kind: 'deliverable',
      id: 'd9',
    });
  });

  it('lists the most sent back first and leaves out what was never sent back', () => {
    const facts = [
      review('changes_requested', { taskId: 'a' }),
      review('changes_requested', { taskId: 'b' }),
      review('rejected', { taskId: 'b' }),
      review('approved', { taskId: 'c' }),
      review('changes_requested', { taskId: 'd' }),
      review('approved', { taskId: 'd' }),
    ];
    const breakdown = buildReworkBreakdown(facts, periods);
    const top = mostSentBack(breakdown.bySubject, 2).map(([key]) => key);
    expect(top).toEqual(['task:b', 'task:d']);
    expect(mostSentBack(breakdown.bySubject, 10)).toHaveLength(3);
  });
});
