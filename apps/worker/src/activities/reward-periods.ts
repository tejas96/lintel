import { type CalendarDate, toCalendarDate } from '@lintel/shared';

function monthStart(year: number, month: number): CalendarDate {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return toCalendarDate(date.toISOString().slice(0, 10));
}

/**
 * The period a scheduled run evaluates on `today`: the previous month for
 * monthly policies; the previous quarter for quarterly ones, but only on the
 * first month of a quarter (otherwise null — nothing to evaluate yet).
 */
export function closedPeriodStart(
  period: 'monthly' | 'quarterly',
  today: CalendarDate,
): CalendarDate | null {
  const [year = 0, month = 1] = today.split('-').map(Number);
  if (period === 'monthly') return monthStart(year, month - 1);
  if ((month - 1) % 3 !== 0) return null;
  return monthStart(year, month - 3);
}
