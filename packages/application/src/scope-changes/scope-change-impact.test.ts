import { DEFAULT_WORKING_CALENDAR, type TaskStatus, type WorkingCalendar } from '@lintel/domain';
import { type CalendarDate, toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import type { ProjectScheduleFacts, ScheduleTaskFact } from './scope-change.store';
import {
  calculateScopeChangeImpact,
  scopeChangeShiftIssues,
  shiftByWorkingDays,
} from './scope-change-impact';

/** Monday–Saturday studio week with Saturday 24 Oct 2026 as a holiday. */
const calendar: WorkingCalendar = {
  ...DEFAULT_WORKING_CALENDAR,
  holidays: new Set<CalendarDate>([toCalendarDate('2026-10-24')]),
};

function task(id: string, dueDate: string, status: TaskStatus = 'ready'): ScheduleTaskFact {
  return {
    id,
    title: `Task ${id}`,
    status,
    plannedStartDate: dueDate,
    dueDate,
    ownerUserId: `owner-${id}`,
    milestoneId: null,
  };
}

function facts(
  tasks: ScheduleTaskFact[],
  edges: [string, string][],
  plannedEndDate = '2026-11-06',
): ProjectScheduleFacts {
  return {
    projectId: 'p1',
    name: 'Saska Residence',
    plannedEndDate,
    tasks,
    dependencies: edges.map(([taskId, dependsOnTaskId]) => ({ taskId, dependsOnTaskId })),
    milestones: [],
  };
}

describe('working-day shifts', () => {
  it('skips Sundays and holidays in both directions', () => {
    const friday = toCalendarDate('2026-10-23');
    expect(shiftByWorkingDays(calendar, friday, 1)).toBe('2026-10-26');
    expect(shiftByWorkingDays(calendar, friday, 2)).toBe('2026-10-27');
    expect(shiftByWorkingDays(calendar, toCalendarDate('2026-10-27'), -2)).toBe('2026-10-23');
    expect(shiftByWorkingDays(calendar, toCalendarDate('2026-10-25'), -1)).toBe('2026-10-22');
  });
});

describe('scope change impact', () => {
  it('pushes every downstream task by the upstream shift', () => {
    const schedule = facts(
      [
        task('a', '2026-10-21'),
        task('b', '2026-10-22'),
        task('c', '2026-10-23'),
        task('d', '2026-10-21'),
      ],
      [
        ['b', 'a'],
        ['c', 'b'],
      ],
    );
    const result = calculateScopeChangeImpact(
      schedule,
      [{ taskId: 'a', shiftWorkingDays: 2 }],
      calendar,
    );
    expect(result.impacts.map((i) => [i.taskId, i.proposedDueDate, i.isDownstream])).toEqual([
      ['a', '2026-10-23', false],
      ['b', '2026-10-26', true],
      ['c', '2026-10-27', true],
    ]);
    expect(result.impacts.every((impact) => impact.shiftWorkingDays === 2)).toBe(true);
    expect(result.projectEndImpactDays).toBe(0);
  });

  it('uses the largest upstream shift and never lets a dependent finish first', () => {
    const schedule = facts(
      [task('a', '2026-10-21'), task('b', '2026-10-21'), task('c', '2026-10-22')],
      [
        ['c', 'a'],
        ['c', 'b'],
      ],
    );
    const result = calculateScopeChangeImpact(
      schedule,
      [
        { taskId: 'a', shiftWorkingDays: 1 },
        { taskId: 'b', shiftWorkingDays: 3 },
        { taskId: 'c', shiftWorkingDays: 1 },
      ],
      calendar,
    );
    const c = result.impacts.find((impact) => impact.taskId === 'c');
    expect(c?.shiftWorkingDays).toBe(3);
    expect(c?.isDownstream).toBe(true);
  });

  it('does not pull dependents earlier when a task finishes sooner', () => {
    const schedule = facts([task('a', '2026-10-28'), task('b', '2026-10-30')], [['b', 'a']]);
    const result = calculateScopeChangeImpact(
      schedule,
      [{ taskId: 'a', shiftWorkingDays: -2 }],
      calendar,
    );
    expect(result.impacts.map((impact) => [impact.taskId, impact.proposedDueDate])).toEqual([
      ['a', '2026-10-26'],
    ]);
  });

  it('reports working days past the planned end and skips finished work', () => {
    const schedule = facts(
      [task('a', '2026-11-04'), task('b', '2026-11-05', 'done'), task('c', '2026-11-06')],
      [
        ['b', 'a'],
        ['c', 'a'],
      ],
    );
    const result = calculateScopeChangeImpact(
      schedule,
      [{ taskId: 'a', shiftWorkingDays: 3 }],
      calendar,
    );
    expect(result.impacts.map((impact) => impact.taskId)).toEqual(['a', 'c']);
    // c moves from Fri 6 Nov to Tue 10 Nov (Sat 7, Mon 9, Tue 10): 3 working days late.
    expect(result.forecastEndDate).toBe('2026-11-10');
    expect(result.projectEndImpactDays).toBe(3);
  });

  it('rejects unknown, repeated and closed tasks', () => {
    const schedule = facts([task('a', '2026-10-21'), task('b', '2026-10-22', 'cancelled')], []);
    const issues = scopeChangeShiftIssues(schedule, [
      { taskId: 'a', shiftWorkingDays: 1 },
      { taskId: 'a', shiftWorkingDays: 2 },
      { taskId: 'b', shiftWorkingDays: 1 },
      { taskId: 'zzz', shiftWorkingDays: 1 },
    ]);
    expect(issues.map((issue) => issue.field)).toEqual([
      'taskShifts.1.taskId',
      'taskShifts.2.taskId',
      'taskShifts.3.taskId',
    ]);
  });
});
