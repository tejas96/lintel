import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { WEEKDAY_CALENDAR } from '../insights/insights.fixtures';
import { isLateToStart, type LateStartInput, planLateStartNudge } from './late-start.policy';

const ready: LateStartInput = {
  status: 'ready',
  ownerUserId: 'meera',
  plannedStartDate: toCalendarDate('2026-10-19'),
  dueDate: toCalendarDate('2026-10-23'),
  prerequisitesDone: true,
  calendar: WEEKDAY_CALENDAR,
  reminderTime: '10:00',
};

describe('late-start nudge', () => {
  it('comes the working day after the planned start, at the reminder time', () => {
    expect(planLateStartNudge(ready)).toEqual({
      at: new Date('2026-10-20T04:30:00.000Z'),
      plannedStartDate: '2026-10-19',
    });
  });

  it('skips the weekend', () => {
    const nudge = planLateStartNudge({
      ...ready,
      plannedStartDate: toCalendarDate('2026-10-23'),
      dueDate: toCalendarDate('2026-10-28'),
    });
    expect(nudge?.at.toISOString()).toBe('2026-10-26T04:30:00.000Z');
  });

  it('is only for committed work that could start and has not', () => {
    expect(planLateStartNudge({ ...ready, status: 'draft' })).toBeNull();
    expect(planLateStartNudge({ ...ready, status: 'in_progress' })).toBeNull();
    expect(planLateStartNudge({ ...ready, ownerUserId: null })).toBeNull();
    expect(planLateStartNudge({ ...ready, plannedStartDate: null })).toBeNull();
    expect(planLateStartNudge({ ...ready, prerequisitesDone: false })).toBeNull();
  });

  it('leaves one-day tasks to the overdue alert', () => {
    expect(planLateStartNudge({ ...ready, dueDate: toCalendarDate('2026-10-19') })).toBeNull();
  });

  it('knows when a task is late to start', () => {
    const today = toCalendarDate('2026-10-21');
    expect(isLateToStart(ready, today)).toBe(true);
    expect(isLateToStart({ ...ready, plannedStartDate: today }, today)).toBe(false);
    expect(isLateToStart({ ...ready, status: 'in_progress' }, today)).toBe(false);
  });
});
