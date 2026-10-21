import { type CalendarDate, toCalendarDate } from '@lintel/shared';
import type { WorkingCalendar } from '../calendar/working-calendar';
import type { RiskContext, RiskTaskFacts } from './risk-card.types';

/** Monday to Friday, 09:30–18:30 in India (UTC+05:30), no holidays. */
export const WEEKDAY_CALENDAR: WorkingCalendar = {
  timeZone: 'Asia/Kolkata',
  workingWeekdays: [1, 2, 3, 4, 5],
  dayStartTime: '09:30',
  dayEndTime: '18:30',
  workingMinutesPerDay: 480,
  holidays: new Set(),
};

export const date = (value: string): CalendarDate => toCalendarDate(value);

/** Wednesday 21 October 2026, 11:30 in India. */
export const RISK_CONTEXT: RiskContext = {
  today: date('2026-10-21'),
  now: new Date('2026-10-21T06:00:00.000Z'),
  calendar: WEEKDAY_CALENDAR,
  reminderTime: '10:00',
};

export function riskTask(id: string, overrides: Partial<RiskTaskFacts> = {}): RiskTaskFacts {
  return {
    id,
    title: `Task ${id}`,
    status: 'in_progress',
    priority: 'medium',
    ownerUserId: 'meera',
    reviewerUserId: 'rohan',
    plannedStartDate: null,
    dueDate: date('2026-10-28'),
    escalateAfterOverdueDays: 1,
    submittedAt: null,
    openBlocker: null,
    openDateRequest: null,
    ownerAway: null,
    ...overrides,
  };
}
