import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKING_CALENDAR } from '../calendar/working-calendar';
import { type CapacityTaskLoad, calculatePersonCapacity, loadStatus } from './capacity.calculator';

const date = toCalendarDate;
const person = {
  userId: 'u1',
  fullName: 'Asha',
  calendar: DEFAULT_WORKING_CALENDAR,
  capacityPercent: 100,
};
const week = { start: date('2026-11-02'), end: date('2026-11-08') };

function load(overrides: Partial<CapacityTaskLoad>): CapacityTaskLoad {
  return {
    taskId: 't',
    userId: 'u1',
    remainingMinutes: 600,
    estimateIsDefault: false,
    startDate: date('2026-11-02'),
    dueDate: date('2026-11-03'),
    commitment: 'confirmed',
    isBlocked: false,
    ...overrides,
  };
}

describe('capacity calculator', () => {
  it('counts working minutes and skips Sunday', () => {
    const result = calculatePersonCapacity(person, week, date('2026-11-02'), [], []);
    expect(result.availableMinutes).toBe(6 * 480);
    expect(result.days.find((day) => day.date === '2026-11-08')?.isWorkingDay).toBe(false);
  });

  it('removes approved leave but only flags pending leave', () => {
    const result = calculatePersonCapacity(
      person,
      week,
      date('2026-11-02'),
      [
        { userId: 'u1', date: date('2026-11-03'), halfDayUnits: 2, status: 'approved' },
        { userId: 'u1', date: date('2026-11-04'), halfDayUnits: 1, status: 'pending' },
      ],
      [],
    );
    const tuesday = result.days.find((day) => day.date === '2026-11-03');
    const wednesday = result.days.find((day) => day.date === '2026-11-04');
    expect(tuesday?.availableMinutes).toBe(0);
    expect(wednesday?.availableMinutes).toBe(480);
    expect(wednesday?.leave).toBe('pending');
  });

  it('spreads effort across the task window and detects overload', () => {
    const result = calculatePersonCapacity(
      person,
      week,
      date('2026-11-02'),
      [],
      [load({ taskId: 'a', remainingMinutes: 1200 })],
    );
    expect(result.days[0]?.confirmedMinutes).toBe(600);
    expect(result.days[0]?.status).toBe('overloaded');
    expect(result.totalStatus).toBe('balanced');
    // One overloaded day is not balanced out by quiet days around it.
    expect(result.status).toBe('overloaded');
    expect(result.overloadedDays).toBe(2);
    expect(result.bookedLeaveDays).toBe(0);
  });

  it('flags work booked on approved leave days', () => {
    const result = calculatePersonCapacity(
      person,
      week,
      date('2026-11-02'),
      [{ userId: 'u1', date: date('2026-11-03'), halfDayUnits: 2, status: 'approved' }],
      [load({ taskId: 'a', remainingMinutes: 600, dueDate: date('2026-11-06') })],
    );
    const tuesday = result.days.find((day) => day.date === '2026-11-03');
    expect(tuesday).toMatchObject({ availableMinutes: 0, confirmedMinutes: 120 });
    expect(tuesday?.status).toBe('overloaded');
    expect(result).toMatchObject({ overloadedDays: 1, bookedLeaveDays: 1, status: 'overloaded' });
  });

  it('keeps the totals status when no single day is overloaded', () => {
    const result = calculatePersonCapacity(
      person,
      week,
      date('2026-11-02'),
      [],
      [load({ taskId: 'a', remainingMinutes: 1200, dueDate: date('2026-11-06') })],
    );
    expect(result).toMatchObject({ overloadedDays: 0, status: result.totalStatus });
  });

  it('keeps tentative and blocked work apart from commitments', () => {
    const result = calculatePersonCapacity(
      person,
      week,
      date('2026-11-02'),
      [],
      [
        load({ taskId: 'draft', commitment: 'tentative' }),
        load({ taskId: 'stuck', isBlocked: true }),
      ],
    );
    expect(result.confirmedMinutes).toBe(0);
    expect(result.tentativeMinutes).toBe(600);
    expect(result.days[0]?.blockedMinutes).toBe(300);
  });

  it('classifies load ratios', () => {
    expect(loadStatus(480, 100)).toBe('available');
    expect(loadStatus(480, 300)).toBe('balanced');
    expect(loadStatus(480, 430)).toBe('stretched');
    expect(loadStatus(480, 520)).toBe('overloaded');
  });
});
