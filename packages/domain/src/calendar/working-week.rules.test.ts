import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { calculatePersonCapacity } from '../capacity/capacity.calculator';
import { planDeadlineEscalation } from '../notifications/deadline-escalation.policy';
import { addWorkingDays, DEFAULT_WORKING_CALENDAR, type WorkingCalendar } from './working-calendar';
import {
  describeWorkingWeekdays,
  minutesOfDay,
  normalizeWeekdays,
  validateWorkingWeek,
  type WorkingWeek,
  weeklyWorkingMinutes,
} from './working-week.rules';

const date = toCalendarDate;
const studioWeek: WorkingWeek = {
  workingWeekdays: [1, 2, 3, 4, 5, 6],
  dayStartTime: '09:30',
  dayEndTime: '18:30',
  workingMinutesPerDay: 480,
};

describe('working week rules', () => {
  it('accepts the default studio week', () => {
    expect(validateWorkingWeek(studioWeek)).toEqual([]);
    expect(weeklyWorkingMinutes(studioWeek)).toBe(2880);
  });

  it('needs at least one real weekday', () => {
    expect(validateWorkingWeek({ ...studioWeek, workingWeekdays: [] })[0]?.field).toBe(
      'workingWeekdays',
    );
    expect(validateWorkingWeek({ ...studioWeek, workingWeekdays: [0, 8] })[0]?.message).toMatch(
      /1 \(Monday\) to 7 \(Sunday\)/,
    );
  });

  it('refuses a day that ends before it starts or has more work than hours', () => {
    const reversed = validateWorkingWeek({ ...studioWeek, dayEndTime: '09:00' });
    expect(reversed).toEqual([
      { field: 'dayEndTime', message: 'The day must end after it starts.' },
    ]);
    const tooLong = validateWorkingWeek({ ...studioWeek, workingMinutesPerDay: 9 * 60 + 1 });
    expect(tooLong[0]?.field).toBe('workingMinutesPerDay');
    const tooShort = validateWorkingWeek({ ...studioWeek, workingMinutesPerDay: 30 });
    expect(tooShort[0]?.message).toMatch(/at least 1 hour/);
  });

  it('reads only 24-hour times', () => {
    expect(minutesOfDay('09:30')).toBe(570);
    expect(minutesOfDay('9:30')).toBeNull();
    expect(minutesOfDay('24:00')).toBeNull();
    expect(validateWorkingWeek({ ...studioWeek, dayStartTime: '9am' })[0]?.field).toBe(
      'dayStartTime',
    );
  });

  it('describes weekdays the way people say them', () => {
    expect(describeWorkingWeekdays([6, 1, 2, 3, 4, 5])).toBe('Monday to Saturday');
    expect(describeWorkingWeekdays([1, 3, 5])).toBe('Monday, Wednesday and Friday');
    expect(describeWorkingWeekdays([1, 2])).toBe('Monday and Tuesday');
    expect(describeWorkingWeekdays([1, 2, 3, 4, 5, 6, 7])).toBe('Every day');
    expect(normalizeWeekdays([5, 1, 5, 3])).toEqual([1, 3, 5]);
  });
});

describe('edited working weeks reach planning and capacity', () => {
  const fourDayWeek: WorkingCalendar = {
    ...DEFAULT_WORKING_CALENDAR,
    workingWeekdays: [1, 2, 3, 4],
    dayStartTime: '08:00',
    dayEndTime: '18:00',
    workingMinutesPerDay: 540,
  };

  it('capacity uses the edited working minutes and weekdays', () => {
    const person = { userId: 'u', fullName: 'Asha', calendar: fourDayWeek, capacityPercent: 100 };
    const week = { start: date('2026-11-02'), end: date('2026-11-08') };
    const result = calculatePersonCapacity(person, week, date('2026-11-02'), [], []);
    expect(result.availableMinutes).toBe(4 * 540);
    expect(result.days.find((day) => day.date === '2026-11-06')?.isWorkingDay).toBe(false);
  });

  it('plans skip the days the edited week does not work', () => {
    // Thursday + 1 working day on a Monday–Thursday week is the next Monday.
    expect(addWorkingDays(fourDayWeek, date('2026-11-05'), 1)).toBe('2026-11-09');
  });

  it('deadline escalations follow the edited start and end of the day', () => {
    const steps = planDeadlineEscalation({
      dueDate: date('2026-11-05'),
      priority: 'medium',
      projectCriticality: 'normal',
      escalateAfterOverdueDays: 1,
      calendar: fourDayWeek,
      reminderTime: '10:00',
    });
    const overdue = steps.find((step) => step.kind === 'task_overdue');
    const manager = steps.find((step) => step.audience === 'project_manager');
    // 18:00 and 08:00 in Kolkata are 12:30 and 02:30 UTC.
    expect(overdue?.at.toISOString()).toBe('2026-11-05T12:30:00.000Z');
    expect(manager?.at.toISOString()).toBe('2026-11-09T02:30:00.000Z');
  });
});
