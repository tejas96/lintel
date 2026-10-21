import { type CalendarDate, toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKING_CALENDAR } from '../calendar/working-calendar';
import {
  planTaskReschedule,
  type RescheduleTaskFact,
  rescheduleChangeIssue,
  type TaskDateChange,
} from './task-reschedule.planner';

const d = (value: string): CalendarDate => toCalendarDate(value);

// Monday 2 Nov 2026; the studio works Monday to Saturday.
const tasks: RescheduleTaskFact[] = [
  {
    id: 'a',
    title: 'Measure',
    status: 'in_progress',
    plannedStartDate: d('2026-11-02'),
    dueDate: d('2026-11-03'),
  },
  {
    id: 'b',
    title: 'Layout',
    status: 'ready',
    plannedStartDate: d('2026-11-04'),
    dueDate: d('2026-11-05'),
  },
  {
    id: 'c',
    title: 'Render',
    status: 'draft',
    plannedStartDate: d('2026-11-10'),
    dueDate: d('2026-11-11'),
  },
  {
    id: 'done',
    title: 'Kick-off',
    status: 'done',
    plannedStartDate: d('2026-11-02'),
    dueDate: d('2026-11-02'),
  },
];
const dependencies = [
  { taskId: 'b', dependsOnTaskId: 'a' },
  { taskId: 'c', dependsOnTaskId: 'b' },
];

function plan(changes: TaskDateChange[], plannedEndDate = '2026-11-11') {
  return planTaskReschedule({
    tasks,
    dependencies,
    changes,
    calendar: DEFAULT_WORKING_CALENDAR,
    plannedEndDate: d(plannedEndDate),
  });
}

describe('rescheduling tasks on the timeline', () => {
  it('pushes waiting work just far enough and lets slack absorb the rest', () => {
    const result = plan([
      { taskId: 'a', plannedStartDate: d('2026-11-02'), dueDate: d('2026-11-05') },
    ]);
    const byId = new Map(result.moves.map((move) => [move.taskId, move]));
    expect(byId.get('a')).toMatchObject({ isDownstream: false, shiftWorkingDays: 2 });
    // Layout must start after Thursday: Friday 6 and Saturday 7.
    expect(byId.get('b')).toMatchObject({
      proposedStartDate: '2026-11-06',
      proposedDueDate: '2026-11-07',
      isDownstream: true,
    });
    // Render already starts on Tuesday 10, after Layout's new end: it stays.
    expect(byId.has('c')).toBe(false);
    expect(result.projectEndImpactDays).toBe(0);
  });

  it('reports how far the agreed end would move', () => {
    const result = plan([
      { taskId: 'b', plannedStartDate: d('2026-11-09'), dueDate: d('2026-11-12') },
    ]);
    const render = result.moves.find((move) => move.taskId === 'c');
    expect(render).toMatchObject({
      proposedStartDate: '2026-11-13',
      proposedDueDate: '2026-11-14',
    });
    expect(result.forecastEndDate).toBe('2026-11-14');
    expect(result.projectEndImpactDays).toBe(3);
  });

  it('never pulls waiting work earlier', () => {
    const result = plan([
      { taskId: 'a', plannedStartDate: d('2026-11-02'), dueDate: d('2026-11-02') },
    ]);
    expect(result.moves.map((move) => move.taskId)).toEqual(['a']);
  });

  it('explains changes it cannot plan', () => {
    const change = { taskId: 'done', plannedStartDate: d('2026-11-03'), dueDate: d('2026-11-03') };
    expect(rescheduleChangeIssue(tasks[3], change)).toBe('"Kick-off" is already closed.');
    expect(
      rescheduleChangeIssue(tasks[0], {
        taskId: 'a',
        plannedStartDate: d('2026-11-05'),
        dueDate: d('2026-11-04'),
      }),
    ).toBe('Start on or before the due date.');
    expect(rescheduleChangeIssue(undefined, change)).toBe('This task is not part of the project.');
  });
});
