import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKING_CALENDAR } from '../calendar/working-calendar';
import {
  type CoverCandidateFact,
  type CoverPersonFact,
  coverNeedMinutes,
  coverWindow,
  suggestCover,
} from './cover-suggestion.strategy';

const leave = { start: toCalendarDate('2026-10-26'), end: toCalendarDate('2026-10-30') };
const today = toCalendarDate('2026-10-21');

describe('cover window', () => {
  it('runs from the later start to the earlier end', () => {
    expect(
      coverWindow(
        { plannedStartDate: toCalendarDate('2026-10-27'), dueDate: toCalendarDate('2026-10-29') },
        leave,
        today,
      ),
    ).toEqual({ start: '2026-10-27', end: '2026-10-29' });
    expect(coverWindow({ plannedStartDate: null, dueDate: null }, leave, today)).toEqual(leave);
  });

  it('covers overdue work from the first day away', () => {
    expect(
      coverWindow({ plannedStartDate: null, dueDate: toCalendarDate('2026-10-20') }, leave, today),
    ).toEqual({ start: '2026-10-26', end: '2026-10-26' });
  });
});

describe('cover need', () => {
  const calendar = { ...DEFAULT_WORKING_CALENDAR, workingWeekdays: [1, 2, 3, 4, 5] };
  const window = { start: toCalendarDate('2026-11-10'), end: toCalendarDate('2026-11-10') };

  it('counts only the share of the effort planned in the window', () => {
    // 36 h spread over 9 working days (Tue 10 – Fri 20 Nov): one day is 4 h.
    const task = {
      plannedStartDate: toCalendarDate('2026-11-10'),
      dueDate: toCalendarDate('2026-11-20'),
    };
    expect(coverNeedMinutes(2160, task, window, calendar, today)).toBe(240);
  });

  it('counts overdue work whole', () => {
    const task = { plannedStartDate: null, dueDate: toCalendarDate('2026-10-19') };
    expect(coverNeedMinutes(600, task, window, calendar, today)).toBe(600);
  });
});

const absent: CoverPersonFact = {
  userId: 'meera',
  designation: 'Interior designer',
  projectRole: 'designer',
};

function person(userId: string, overrides: Partial<CoverCandidateFact>): CoverCandidateFact {
  return {
    userId,
    designation: null,
    projectRole: null,
    freeMinutes: 600,
    availableMinutes: 2400,
    awayInWindow: false,
    ...overrides,
  };
}

describe('cover suggestions', () => {
  const task = { reviewerUserId: 'rohan', needMinutes: 480 };

  it('ranks the same project role with room above a plain member', () => {
    const suggestions = suggestCover(task, absent, [
      person('kabir', { projectRole: 'member' }),
      person('anika', { projectRole: 'designer' }),
    ]);
    expect(suggestions.map((item) => item.userId)).toEqual(['anika', 'kabir']);
    expect(suggestions[0]).toMatchObject({
      score: 70,
      hasRoom: true,
      reasons: ['Designer on this project', '10 h free in those days'],
    });
  });

  it('considers the same designation outside the project', () => {
    const [only] = suggestCover(task, absent, [
      person('dev', { designation: ' interior Designer ', freeMinutes: 120 }),
    ]);
    expect(only).toMatchObject({
      userId: 'dev',
      hasRoom: false,
      reasons: ['Also interior designer', 'Only 2 h free; the task needs about 8 h then'],
    });
  });

  it('leaves out outsiders, people away, people not working, the absent owner and the reviewer', () => {
    expect(
      suggestCover(task, absent, [
        person('stranger', {}),
        person('away', { projectRole: 'designer', awayInWindow: true }),
        person('off', { projectRole: 'designer', availableMinutes: 0 }),
        person('meera', { projectRole: 'designer' }),
        person('rohan', { projectRole: 'reviewer' }),
      ]),
    ).toEqual([]);
  });

  it('keeps fully booked people but lower, and suggests three at most', () => {
    const suggestions = suggestCover(task, absent, [
      person('a', { projectRole: 'designer', freeMinutes: -60 }),
      person('b', { projectRole: 'member' }),
      person('c', { projectRole: 'member', freeMinutes: 300 }),
    ]);
    expect(suggestions.map((item) => item.userId)).toEqual(['b', 'c', 'a']);
    expect(suggestions[2]?.reasons).toContain('Fully booked in those days');
    const many = ['p', 'q', 'r', 's'].map((id) => person(id, { projectRole: 'member' }));
    expect(suggestCover(task, absent, many)).toHaveLength(3);
  });
});
