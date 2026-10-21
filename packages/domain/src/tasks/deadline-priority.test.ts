import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import type { PriorityClock } from './deadline-priority';
import { deadlineSignal, isOverdueAt } from './deadline-priority';
import { isDeadlinePassed, minutesUntilDeadlineToday } from './task-deadline';
import { type PrioritizationInput, rankWorkQueue } from './task-priority.strategy';

const today = toCalendarDate('2026-10-21');
const at = (time: string): PriorityClock => ({ now: { date: today, time }, dayEndTime: '18:30' });

function task(overrides: Partial<PrioritizationInput> & { taskId: string }): PrioritizationInput {
  return {
    title: overrides.taskId,
    status: 'ready',
    priority: 'medium',
    dueDate: today,
    dueTime: null,
    estimateMinutes: null,
    projectCriticality: 'normal',
    openDependentCount: 0,
    milestoneDueDate: null,
    milestoneName: null,
    hasUnmetPrerequisites: false,
    isBlocked: false,
    ...overrides,
  };
}

describe('task deadlines with an optional due time', () => {
  it('falls due at the due time, or at the end of the working day', () => {
    expect(isDeadlinePassed(today, '11:00', { date: today, time: '11:00' }, '18:30')).toBe(false);
    expect(isDeadlinePassed(today, '11:00', { date: today, time: '11:01' }, '18:30')).toBe(true);
    expect(isDeadlinePassed(today, null, { date: today, time: '18:00' }, '18:30')).toBe(false);
    expect(isDeadlinePassed(today, null, { date: today, time: '18:31' }, '18:30')).toBe(true);
    const tomorrow = toCalendarDate('2026-10-22');
    expect(isDeadlinePassed(today, '11:00', { date: tomorrow, time: '08:00' }, '18:30')).toBe(true);
    expect(minutesUntilDeadlineToday('11:00', { date: today, time: '09:30' }, '18:30')).toBe(90);
  });

  it('keeps the date-only rule when no clock is given', () => {
    expect(isOverdueAt({ dueDate: today, dueTime: '09:00' }, today, undefined)).toBe(false);
    expect(isOverdueAt({ dueDate: today, dueTime: '09:00' }, today, at('10:00'))).toBe(true);
  });

  it('marks a task overdue once its due time has passed today', () => {
    const [entry] = rankWorkQueue(
      [task({ taskId: 'meeting', dueTime: '11:00' })],
      today,
      undefined,
      at('12:15'),
    );
    expect(entry?.bucket).toBe('overdue');
    expect(entry?.headline).toBe('Recommended because it was due today at 11:00.');
  });

  it('adds urgency when the due time is less than two hours away', () => {
    const soon = deadlineSignal({ dueDate: today, dueTime: '11:00' }, today, at('09:45'));
    expect(soon).toMatchObject({ code: 'DUE_WITHIN_HOURS', points: 34 });
    expect(soon?.explanation).toBe('It is due at 11:00 today, in under 2 hours.');
    const later = deadlineSignal({ dueDate: today, dueTime: '17:00' }, today, at('09:45'));
    expect(later).toMatchObject({ code: 'DUE_TODAY', points: 30 });
    expect(later?.explanation).toBe('It is due today at 17:00.');
  });

  it('orders equal scores by due time, with no time meaning the end of the day', () => {
    const ranked = rankWorkQueue(
      [
        task({ taskId: 'end of day' }),
        task({ taskId: 'afternoon', dueTime: '16:00' }),
        task({ taskId: 'noon', dueTime: '12:00' }),
      ],
      today,
      undefined,
      at('08:00'),
    );
    expect(ranked.map((entry) => entry.taskId)).toEqual(['noon', 'afternoon', 'end of day']);
  });

  it('mentions the time for a task due tomorrow', () => {
    const signal = deadlineSignal(
      { dueDate: toCalendarDate('2026-10-22'), dueTime: '10:30' },
      today,
      at('09:00'),
    );
    expect(signal?.explanation).toBe('It is due tomorrow at 10:30.');
  });
});
