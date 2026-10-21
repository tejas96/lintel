import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import {
  buildEstimateBreakdown,
  type EstimateFact,
  estimateOutcome,
  tallyEstimates,
} from './estimate-accuracy.metrics';
import { reportPeriods } from './report-periods';

const date = toCalendarDate;

function task(estimateMinutes: number | null, loggedMinutes: number, extra = {}): EstimateFact {
  return {
    taskId: `t-${estimateMinutes}-${loggedMinutes}`,
    projectId: 'p1',
    ownerUserId: 'u1',
    taskTypeKey: 'tpl:layout',
    templateId: 'tpl',
    completedOn: date('2026-10-07'),
    estimateMinutes,
    loggedMinutes,
    ...extra,
  };
}

describe('estimate outcome', () => {
  it('counts 80 % and 120 % of the estimate as within, both ends included', () => {
    expect(estimateOutcome(task(100, 80))).toBe('within');
    expect(estimateOutcome(task(100, 120))).toBe('within');
    expect(estimateOutcome(task(300, 360))).toBe('within');
    expect(estimateOutcome(task(100, 100))).toBe('within');
  });

  it('counts just past either end as over or under', () => {
    expect(estimateOutcome(task(100, 121))).toBe('over');
    expect(estimateOutcome(task(100, 79))).toBe('under');
    expect(estimateOutcome(task(1000, 1201))).toBe('over');
    expect(estimateOutcome(task(1000, 799))).toBe('under');
  });

  it('keeps tasks without an estimate or without logged time out of the measure', () => {
    expect(estimateOutcome(task(null, 90))).toBe('no_estimate');
    expect(estimateOutcome(task(0, 90))).toBe('no_estimate');
    expect(estimateOutcome(task(120, 0))).toBe('not_measured');
  });
});

describe('estimate tally', () => {
  it('has no ratios when nothing was measured', () => {
    expect(tallyEstimates([])).toMatchObject({
      measured: 0,
      effortRatio: null,
      withinRate: null,
      medianRatio: null,
    });
    expect(tallyEstimates([task(60, 0), task(null, 30)])).toMatchObject({
      measured: 0,
      effortRatio: null,
      notMeasured: 1,
      withoutEstimate: 1,
    });
  });

  it('sums measured tasks only and takes the median per-task ratio', () => {
    const tally = tallyEstimates([
      task(100, 80), // 0.8 within
      task(100, 150), // 1.5 over
      task(200, 100), // 0.5 under
      task(60, 0), // not measured
      task(null, 45), // without an estimate
    ]);
    expect(tally).toEqual({
      measured: 3,
      estimatedMinutes: 400,
      loggedMinutes: 330,
      effortRatio: 0.825,
      within: 1,
      over: 1,
      under: 1,
      withinRate: 0.333,
      medianRatio: 0.8,
      notMeasured: 1,
      withoutEstimate: 1,
    });
  });

  it('takes the mean of the two middle ratios for an even count', () => {
    const tally = tallyEstimates([task(100, 105), task(100, 120), task(100, 60), task(100, 215)]);
    // Ratios 0.6, 1.05, 1.2, 2.15: the middle two average 1.125; 500 ÷ 400 overall.
    expect(tally.medianRatio).toBe(1.125);
    expect(tally.effortRatio).toBe(1.25);
  });
});

describe('estimate breakdown', () => {
  it('groups by person, task type, template and completion period', () => {
    const range = { start: date('2026-10-05'), end: date('2026-10-18') };
    const periods = reportPeriods(range, 'week');
    const facts = [
      task(100, 100),
      task(100, 200, { ownerUserId: 'u2', completedOn: date('2026-10-14') }),
      task(60, 30, { ownerUserId: null, taskTypeKey: null, templateId: null }),
      task(100, 100, { completedOn: date('2026-09-30') }),
    ];
    const breakdown = buildEstimateBreakdown(facts, periods);
    expect(breakdown.totals.measured).toBe(3);
    expect(breakdown.byPeriod.map((period) => period.measured)).toEqual([2, 1]);
    expect([...breakdown.byOwner.keys()].sort()).toEqual(['u1', 'u2']);
    expect(breakdown.byTaskType.get(null)?.under).toBe(1);
    expect(breakdown.byTaskType.get('tpl:layout')).toMatchObject({ within: 1, over: 1 });
    expect(breakdown.byTemplate.get(null)?.measured).toBe(1);
    expect(breakdown.byTemplate.get('tpl')?.medianRatio).toBe(1.5);
  });
});
