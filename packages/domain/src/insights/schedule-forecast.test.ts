import { describe, expect, it } from 'vitest';
import { date, WEEKDAY_CALENDAR } from './insights.fixtures';
import {
  type ForecastTask,
  forecastCommitment,
  forecastSchedule,
  rootCauseOf,
} from './schedule-forecast';

const today = date('2026-10-21');

function task(id: string, overrides: Partial<ForecastTask>): ForecastTask {
  return {
    id,
    status: 'ready',
    plannedStartDate: null,
    dueDate: date('2026-10-30'),
    hasOpenBlocker: false,
    ...overrides,
  };
}

describe('schedule forecast', () => {
  it('keeps work that is on plan on its due date', () => {
    const forecast = forecastSchedule(
      [task('a', { plannedStartDate: date('2026-10-22'), dueDate: date('2026-10-23') })],
      [],
      WEEKDAY_CALENDAR,
      today,
    ).get('a');
    expect(forecast).toMatchObject({
      forecastFinish: '2026-10-23',
      slipWorkingDays: 0,
      cause: 'on_plan',
    });
  });

  it('moves a late start by the days lost, keeping the duration', () => {
    // Planned Mon–Wed (three working days); still not started on Wednesday.
    const forecast = forecastSchedule(
      [task('a', { plannedStartDate: date('2026-10-19'), dueDate: date('2026-10-21') })],
      [],
      WEEKDAY_CALENDAR,
      today,
    ).get('a');
    expect(forecast).toMatchObject({
      forecastFinish: '2026-10-23',
      slipWorkingDays: 2,
      cause: 'late_start',
    });
  });

  it('lets overdue work finish today at the earliest', () => {
    const forecast = forecastSchedule(
      [task('a', { status: 'in_progress', dueDate: date('2026-10-19') })],
      [],
      WEEKDAY_CALENDAR,
      today,
    ).get('a');
    expect(forecast).toMatchObject({
      forecastFinish: '2026-10-21',
      slipWorkingDays: 2,
      cause: 'overdue',
    });
  });

  it('skips the weekend when today is not a working day', () => {
    const forecast = forecastSchedule(
      [task('a', { status: 'in_progress', dueDate: date('2026-10-23') })],
      [],
      WEEKDAY_CALENDAR,
      date('2026-10-24'),
    ).get('a');
    expect(forecast).toMatchObject({ forecastFinish: '2026-10-26', slipWorkingDays: 1 });
  });

  it('pushes work that waits on a late prerequisite and traces the root cause', () => {
    const forecasts = forecastSchedule(
      [
        task('design', { status: 'blocked', dueDate: date('2026-10-20') }),
        task('drawings', { plannedStartDate: date('2026-10-21'), dueDate: date('2026-10-22') }),
      ],
      [{ taskId: 'drawings', dependsOnTaskId: 'design' }],
      WEEKDAY_CALENDAR,
      today,
    );
    expect(forecasts.get('design')).toMatchObject({
      forecastFinish: '2026-10-21',
      cause: 'blocked',
    });
    expect(forecasts.get('drawings')).toMatchObject({
      forecastFinish: '2026-10-23',
      slipWorkingDays: 1,
      cause: 'waiting_on_prerequisite',
      pushedBy: 'design',
    });
    expect(rootCauseOf('drawings', forecasts)?.taskId).toBe('design');
  });

  it('never lets finished or cancelled work delay anything', () => {
    const forecasts = forecastSchedule(
      [
        task('done', { status: 'done', dueDate: date('2026-10-10') }),
        task('next', { plannedStartDate: date('2026-10-22'), dueDate: date('2026-10-23') }),
      ],
      [{ taskId: 'next', dependsOnTaskId: 'done' }],
      WEEKDAY_CALENDAR,
      today,
    );
    expect(forecasts.has('done')).toBe(false);
    expect(forecasts.get('next')).toMatchObject({ slipWorkingDays: 0, pushedBy: null });
  });

  it('cuts a dependency loop instead of looping forever', () => {
    const forecasts = forecastSchedule(
      [task('a', {}), task('b', {})],
      [
        { taskId: 'a', dependsOnTaskId: 'b' },
        { taskId: 'b', dependsOnTaskId: 'a' },
      ],
      WEEKDAY_CALENDAR,
      today,
    );
    expect(forecasts.size).toBe(2);
  });

  it('forecasts a commitment from its latest open task', () => {
    const forecasts = forecastSchedule(
      [
        task('a', { status: 'in_progress', dueDate: date('2026-10-22') }),
        task('b', { status: 'in_progress', dueDate: date('2026-10-27') }),
      ],
      [],
      WEEKDAY_CALENDAR,
      today,
    );
    expect(forecastCommitment(date('2026-10-23'), ['a', 'b'], forecasts, WEEKDAY_CALENDAR)).toEqual(
      {
        forecastDate: '2026-10-27',
        slipWorkingDays: 2,
        driverTaskId: 'b',
      },
    );
    expect(
      forecastCommitment(date('2026-10-23'), ['missing'], forecasts, WEEKDAY_CALENDAR),
    ).toBeNull();
  });
});
