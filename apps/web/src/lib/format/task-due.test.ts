import { describe, expect, it } from 'vitest';
import { describeTaskDue, formatTimeOfDay } from './task-due';

const today = '2026-10-21';

describe('task due wording', () => {
  it('formats wall-clock times the way the studio says them', () => {
    expect(formatTimeOfDay('09:05')).toBe('9:05 am');
    expect(formatTimeOfDay('12:00')).toBe('12:00 pm');
    expect(formatTimeOfDay('00:30')).toBe('12:30 am');
    expect(formatTimeOfDay('18:30')).toBe('6:30 pm');
  });

  it('adds the time when one is set', () => {
    const due = (dueDate: string, isOverdue = false) =>
      describeTaskDue({ dueDate, dueTime: '11:00', isOverdue }, today);
    expect(due(today)).toEqual({ text: 'Due 11:00 am today', late: false, soon: true });
    expect(due(today, true)).toEqual({ text: 'Was due 11:00 am', late: true, soon: false });
    expect(due('2026-10-22')?.text).toBe('Due 11:00 am tomorrow');
    expect(due('2026-10-24')?.text).toBe('Due in 3 days, 11:00 am');
    expect(due('2026-10-19', true)?.text).toBe('2 days late');
  });

  it('keeps the date wording without a time, late once the working day has ended', () => {
    expect(describeTaskDue({ dueDate: today, dueTime: null, isOverdue: false }, today)).toEqual({
      text: 'Due today',
      late: false,
      soon: true,
    });
    expect(describeTaskDue({ dueDate: today, dueTime: null, isOverdue: true }, today)?.late).toBe(
      true,
    );
    expect(describeTaskDue({ dueDate: null, dueTime: null, isOverdue: false }, today)).toBeNull();
  });
});
