import type { RewardPeriod } from '@lintel/domain';
import { addDays, type CalendarDate, toCalendarDate } from '@lintel/shared';

export interface RewardPeriodRange {
  readonly start: CalendarDate;
  readonly end: CalendarDate;
}

function firstOfMonth(year: number, month: number): CalendarDate {
  const normalisedYear = year + Math.floor((month - 1) / 12);
  const normalisedMonth = ((((month - 1) % 12) + 12) % 12) + 1;
  return toCalendarDate(`${normalisedYear}-${String(normalisedMonth).padStart(2, '0')}-01`);
}

/** The month or quarter containing `date`: from its first day to its last day. */
export function rewardPeriodFor(date: CalendarDate, period: RewardPeriod): RewardPeriodRange {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const startMonth = period === 'monthly' ? month : Math.floor((month - 1) / 3) * 3 + 1;
  const length = period === 'monthly' ? 1 : 3;
  const start = firstOfMonth(year, startMonth);
  return { start, end: addDays(firstOfMonth(year, startMonth + length), -1) };
}

/** The period right before, of the same kind (used for the improvement criterion). */
export function previousRewardPeriod(
  current: RewardPeriodRange,
  period: RewardPeriod,
): RewardPeriodRange {
  return rewardPeriodFor(addDays(current.start, -1), period);
}
