import { DEFAULT_WORKING_CALENDAR } from '@lintel/domain';
import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import type { CompletedTaskRecord } from './reward.store';
import {
  blockerReportsFor,
  externalBlockedWorkingDays,
  milestonesDeliveredOnTime,
  onTimeRateOf,
  taskOutcomesFor,
} from './reward-facts';
import { previousRewardPeriod, rewardPeriodFor } from './reward-period';

const at = (value: string) => new Date(`${value}+05:30`);
const context = { calendar: DEFAULT_WORKING_CALENDAR, timeZone: 'Asia/Kolkata' };
const october = { from: at('2026-10-01T00:00:00'), to: at('2026-11-01T00:00:00') };

function done(overrides: Partial<CompletedTaskRecord>): CompletedTaskRecord {
  return {
    taskId: 't',
    ownerUserId: 'ana',
    collaboratorUserIds: [],
    completedAt: at('2026-10-09T12:00:00'),
    dueDate: '2026-10-09',
    requiresReview: false,
    reviewRounds: 0,
    requiredChecklistCompletedAt: [],
    blockers: [],
    ...overrides,
  };
}

describe('reward periods', () => {
  it('normalises to the first day of the month or quarter', () => {
    expect(rewardPeriodFor(toCalendarDate('2026-10-15'), 'monthly')).toEqual({
      start: '2026-10-01',
      end: '2026-10-31',
    });
    expect(rewardPeriodFor(toCalendarDate('2026-11-20'), 'quarterly')).toEqual({
      start: '2026-10-01',
      end: '2026-12-31',
    });
    expect(rewardPeriodFor(toCalendarDate('2026-02-10'), 'monthly').end).toBe('2026-02-28');
  });

  it('finds the previous period across a year boundary', () => {
    const q1 = rewardPeriodFor(toCalendarDate('2027-02-01'), 'quarterly');
    expect(previousRewardPeriod(q1, 'quarterly')).toEqual({
      start: '2026-10-01',
      end: '2026-12-31',
    });
  });
});

describe('reward fact assembly', () => {
  it('counts only external waiting, once per working day', () => {
    const task = done({
      completedAt: at('2026-10-12T12:00:00'),
      blockers: [
        // Client: Mon 5 → Thu 8 = 5, 6, 7.
        {
          category: 'client',
          raisedAt: at('2026-10-05T10:00:00'),
          resolvedAt: at('2026-10-08T10:00:00'),
        },
        // Supplier overlaps 7 and adds Sat 10 (Sunday 11 is not a working day).
        {
          category: 'supplier',
          raisedAt: at('2026-10-07T10:00:00'),
          resolvedAt: at('2026-10-12T09:00:00'),
        },
        // Internal dependencies are the team's own responsibility.
        { category: 'internal_dependency', raisedAt: at('2026-10-01T10:00:00'), resolvedAt: null },
      ],
    });
    expect(externalBlockedWorkingDays(task, context)).toBe(6);
  });

  it('builds owner and collaborator facts with due dates, reviews and checklists', () => {
    const outcomes = taskOutcomesFor(
      new Set(['ana']),
      [
        done({ taskId: 'owned', requiresReview: true, reviewRounds: 1 }),
        done({
          taskId: 'shared',
          ownerUserId: 'dev',
          collaboratorUserIds: ['ana'],
          requiredChecklistCompletedAt: [at('2026-10-09T13:00:00')],
        }),
        done({ taskId: 'no-due', dueDate: null, requiredChecklistCompletedAt: [null] }),
        done({ taskId: 'september', completedAt: at('2026-09-30T23:00:00') }),
        done({ taskId: 'not-mine', ownerUserId: 'dev' }),
      ],
      october,
      context,
    );
    expect(outcomes.map((o) => [o.taskId, o.isOwner, o.checklistCompleteAtFinish])).toEqual([
      ['owned', true, true],
      ['shared', false, false],
      ['no-due', true, false],
    ]);
    expect(outcomes[0]).toMatchObject({ wasReviewed: true, reviewRounds: 1 });
    expect(outcomes[2]?.effectiveDueDate).toBe('2026-10-09');
  });

  it('uses the current (rescheduled) due date and forgives external waiting', () => {
    const outcomes = taskOutcomesFor(
      new Set(['ana']),
      [
        done({ taskId: 'late', completedAt: at('2026-10-12T12:00:00'), dueDate: '2026-10-07' }),
        done({
          taskId: 'waited',
          completedAt: at('2026-10-09T12:00:00'),
          dueDate: '2026-10-07',
          blockers: [
            {
              category: 'client',
              raisedAt: at('2026-10-05T10:00:00'),
              resolvedAt: at('2026-10-08T10:00:00'),
            },
          ],
        }),
        done({
          taskId: 'rescheduled',
          completedAt: at('2026-10-14T12:00:00'),
          dueDate: '2026-10-16',
        }),
      ],
      october,
      context,
    );
    expect(onTimeRateOf(outcomes)).toBeCloseTo(2 / 3);
    expect(onTimeRateOf([])).toBeNull();
  });

  it('counts early blocker reports and milestones the subject delivered on time', () => {
    const reports = blockerReportsFor(
      new Set(['ana']),
      [
        { raisedByUserId: 'ana', raisedAt: at('2026-10-14T10:00:00'), taskDueDate: '2026-10-24' },
        { raisedByUserId: 'dev', raisedAt: at('2026-10-14T10:00:00'), taskDueDate: '2026-10-24' },
      ],
      october,
      'Asia/Kolkata',
    );
    expect(reports).toEqual([{ reportedOn: '2026-10-14', taskDueDate: '2026-10-24' }]);
    const milestones = [
      {
        milestoneId: 'm1',
        dueDate: '2026-10-06',
        completedAt: at('2026-10-05T17:00:00'),
        taskOwnerUserIds: ['ana'],
      },
      {
        milestoneId: 'm2',
        dueDate: '2026-10-06',
        completedAt: at('2026-10-07T17:00:00'),
        taskOwnerUserIds: ['ana'],
      },
      {
        milestoneId: 'm3',
        dueDate: '2026-10-20',
        completedAt: at('2026-10-19T17:00:00'),
        taskOwnerUserIds: ['dev'],
      },
    ];
    expect(milestonesDeliveredOnTime(new Set(['ana']), milestones, october, 'Asia/Kolkata')).toBe(
      1,
    );
  });
});
