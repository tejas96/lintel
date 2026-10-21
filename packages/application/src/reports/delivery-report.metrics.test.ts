import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import {
  buildDeliveryBreakdown,
  type DeliveryFact,
  placeDelivery,
  tallyDelivery,
} from './delivery-report.metrics';
import { reportPeriods } from './report-periods';

const date = toCalendarDate;
const range = { start: date('2026-10-01'), end: date('2026-10-31') };
const today = date('2026-10-21');

function task(overrides: Partial<DeliveryFact>): DeliveryFact {
  return {
    kind: 'task',
    projectId: 'p1',
    ownerUserId: 'u1',
    dueDate: date('2026-10-10'),
    completedOn: date('2026-10-10'),
    ...overrides,
  };
}

describe('delivery reliability rules', () => {
  it('counts work finished on or before its due date as on time', () => {
    expect(placeDelivery(task({}), range, today)).toEqual({
      outcome: 'on_time',
      date: '2026-10-10',
      daysLate: 0,
    });
    expect(placeDelivery(task({ completedOn: date('2026-10-04') }), range, today)?.outcome).toBe(
      'on_time',
    );
  });

  it('counts work finished after its due date as late, by calendar days', () => {
    expect(placeDelivery(task({ completedOn: date('2026-10-13') }), range, today)).toEqual({
      outcome: 'late',
      date: '2026-10-13',
      daysLate: 3,
    });
  });

  it('places completed work by its completion day, so late work due earlier still counts', () => {
    const lateFromSeptember = task({
      dueDate: date('2026-09-28'),
      completedOn: date('2026-10-02'),
    });
    expect(placeDelivery(lateFromSeptember, range, today)?.outcome).toBe('late');
    const finishedInSeptember = task({ completedOn: date('2026-09-30') });
    expect(placeDelivery(finishedInSeptember, range, today)).toBeNull();
  });

  it('counts open work due in the range and before today as open overdue', () => {
    expect(placeDelivery(task({ completedOn: null }), range, today)).toEqual({
      outcome: 'open_overdue',
      date: '2026-10-10',
      daysLate: 11,
    });
    expect(placeDelivery(task({ completedOn: null, dueDate: today }), range, today)).toBeNull();
    expect(
      placeDelivery(task({ completedOn: null, dueDate: date('2026-09-20') }), range, today),
    ).toBeNull();
  });

  it('rates on time over completed work only and averages lateness over late work', () => {
    const tally = tallyDelivery([
      { outcome: 'on_time', date: today, daysLate: 0 },
      { outcome: 'on_time', date: today, daysLate: 0 },
      { outcome: 'late', date: today, daysLate: 2 },
      { outcome: 'late', date: today, daysLate: 5 },
      { outcome: 'open_overdue', date: today, daysLate: 9 },
    ]);
    expect(tally).toEqual({
      onTime: 2,
      late: 2,
      openOverdue: 1,
      onTimeRate: 0.5,
      averageDaysLate: 3.5,
    });
    expect(tallyDelivery([]).onTimeRate).toBeNull();
  });
});

describe('delivery breakdown', () => {
  it('splits by period, project and task owner; milestones have no owner', () => {
    const facts: DeliveryFact[] = [
      task({}),
      task({ completedOn: date('2026-10-14'), ownerUserId: 'u2', projectId: 'p2' }),
      task({ completedOn: null, dueDate: date('2026-10-15'), ownerUserId: null }),
      {
        kind: 'milestone',
        projectId: 'p1',
        ownerUserId: null,
        dueDate: date('2026-10-12'),
        completedOn: date('2026-10-12'),
      },
    ];
    const plan = { range, today, periods: reportPeriods(range, 'week') };
    const result = buildDeliveryBreakdown(facts, plan);
    expect(result.totals.tasks).toMatchObject({ onTime: 1, late: 1, openOverdue: 1 });
    expect(result.totals.milestones).toMatchObject({ onTime: 1, onTimeRate: 1 });
    expect(result.byPeriod).toHaveLength(plan.periods.length);
    expect(result.byPeriod[1]?.tasks.onTime).toBe(1);
    expect(result.byPeriod[2]?.tasks).toMatchObject({ late: 1, openOverdue: 1 });
    expect(result.byProject.get('p1')?.milestones.onTime).toBe(1);
    expect(result.byProject.get('p2')?.tasks.late).toBe(1);
    expect([...result.byOwner.keys()].sort()).toEqual(['u1', 'u2']);
  });
});
