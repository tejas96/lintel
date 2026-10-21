import { describe, expect, it } from 'vitest';
import {
  dueDateLine,
  dueLabel,
  formatDateRange,
  formatTimeOfDay,
  relativeDayLabel,
  taskDueLabel,
  withReadableDates,
} from './dates';
import { formatElapsed, formatHalfDayNumber, formatHalfDays, formatMinutes } from './quantities';

describe('dates', () => {
  it('describes due dates relative to the business day', () => {
    expect(dueLabel('2026-10-21', '2026-10-21')).toBe('Due today');
    expect(dueLabel('2026-10-22', '2026-10-21')).toBe('Due tomorrow');
    expect(dueLabel('2026-10-20', '2026-10-21')).toBe('1 day overdue');
    expect(dueLabel('2026-10-18', '2026-10-21')).toBe('3 days overdue');
    expect(dueLabel(null, '2026-10-21')).toBe('No due date');
    expect(relativeDayLabel('2026-10-27', '2026-10-21')).toBe('in 6 days');
  });

  it('keeps calendar dates on their day in any phone timezone', () => {
    expect(formatDateRange('2026-10-26', '2026-10-28')).toBe('26 – 28 Oct');
    expect(formatDateRange('2026-10-30', '2026-11-02')).toBe('30 Oct – 2 Nov');
  });

  it('makes server sentences with ISO dates readable', () => {
    expect(withReadableDates('#1: due 2026-10-26 → 2026-10-30')).toBe('#1: due 26 Oct → 30 Oct');
    expect(withReadableDates('No dates here, version 2026-1')).toBe(
      'No dates here, version 2026-1',
    );
  });
});

describe('due times', () => {
  const today = '2026-10-21';
  const dueAt = (dueDate: string, isOverdue = false) =>
    taskDueLabel({ dueDate, dueTime: '11:00', isOverdue }, today);

  it('prints a studio wall-clock time with lower-case am/pm', () => {
    expect(formatTimeOfDay('14:30')).toBe('2:30 pm');
    expect(formatTimeOfDay('09:05')).toBe('9:05 am');
    expect(formatTimeOfDay('11:00')).toBe('11:00 am');
    expect(formatTimeOfDay('12:00')).toBe('12:00 pm');
    expect(formatTimeOfDay('00:00')).toBe('12:00 am');
    expect(formatTimeOfDay('23:59')).toBe('11:59 pm');
  });

  it('adds the due time to the label', () => {
    expect(dueAt('2026-10-21')).toEqual({ text: 'Due 11:00 am today', late: false });
    expect(dueAt('2026-10-21', true)).toEqual({ text: 'Was due 11:00 am', late: true });
    expect(dueAt('2026-10-22')).toEqual({ text: 'Due 11:00 am tomorrow', late: false });
    expect(dueAt('2026-10-23')).toEqual({ text: 'Due Fri, 23 Oct, 11:00 am', late: false });
    expect(dueAt('2026-10-20', true)).toEqual({ text: '1 day overdue', late: true });
    expect(dueAt('2026-10-18', true)).toEqual({ text: '3 days overdue', late: true });
  });

  it('keeps the day wording without a time, turning late once the working day ends', () => {
    const endOfDay = { dueDate: '2026-10-21', dueTime: null };
    expect(taskDueLabel({ ...endOfDay, isOverdue: false }, today)).toEqual({
      text: 'Due today',
      late: false,
    });
    expect(taskDueLabel({ ...endOfDay, isOverdue: true }, today)).toEqual({
      text: 'Due today',
      late: true,
    });
    expect(taskDueLabel({ dueDate: null, dueTime: null, isOverdue: false }, today).text).toBe(
      'No due date',
    );
  });

  it('prints the full due moment beside its distance', () => {
    expect(dueDateLine({ dueDate: '2026-10-23', dueTime: '14:30' }, today)).toBe(
      'Fri, 23 Oct, 2:30 pm · in 2 days',
    );
    expect(dueDateLine({ dueDate: '2026-10-21', dueTime: null }, today)).toBe(
      'Wed, 21 Oct · today',
    );
    expect(dueDateLine({ dueDate: null, dueTime: null }, today)).toBe('No due date');
  });
});

describe('quantities', () => {
  it('formats durations and leave in half days', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(150)).toBe('2 h 30 min');
    expect(formatElapsed(3849)).toBe('1:04:09');
    expect(formatHalfDays(1)).toBe('½ day');
    expect(formatHalfDays(2)).toBe('1 day');
    expect(formatHalfDays(3)).toBe('1½ days');
    expect(formatHalfDayNumber(24)).toBe('12');
  });
});
