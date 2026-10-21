import { addDays, daysBetween, formatCalendarDate } from '@/lib/format/dates';

export interface PeriodPreset {
  readonly id: string;
  readonly label: string;
  readonly from: string;
  readonly to: string;
}

/** The longest range the API accepts. */
export const MAX_PERIOD_DAYS = 366;

const firstOfMonth = (date: string) => `${date.slice(0, 7)}-01`;

function monthStart(year: number, month: number): string {
  const normalized = new Date(Date.UTC(year, month - 1, 1));
  return normalized.toISOString().slice(0, 10);
}

/**
 * Ranges people ask for, ending today unless they are whole past periods.
 * `ahead` adds a forward-looking choice for planning (workload).
 */
export function periodPresets(today: string, options: { ahead?: boolean } = {}): PeriodPreset[] {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const quarterMonth = month - ((month - 1) % 3);
  const thisQuarter = monthStart(year, quarterMonth);
  const lastQuarter = monthStart(year, quarterMonth - 3);
  const lastMonth = monthStart(year, month - 1);
  return [
    { id: 'last-30', label: 'Last 30 days', from: addDays(today, -29), to: today },
    { id: 'last-90', label: 'Last 90 days', from: addDays(today, -89), to: today },
    { id: 'this-month', label: 'This month', from: firstOfMonth(today), to: today },
    {
      id: 'last-month',
      label: 'Last month',
      from: lastMonth,
      to: addDays(firstOfMonth(today), -1),
    },
    { id: 'this-quarter', label: 'This quarter', from: thisQuarter, to: today },
    { id: 'last-quarter', label: 'Last quarter', from: lastQuarter, to: addDays(thisQuarter, -1) },
    ...(options.ahead
      ? [{ id: 'next-4-weeks', label: 'Next 4 weeks', from: today, to: addDays(today, 27) }]
      : []),
  ];
}

/** "21 Oct", "1 Aug – 21 Oct", or with years when they differ from today's. */
export function describeRange(from: string, to: string, today: string): string {
  if (from === to) return formatCalendarDate(from, today);
  return `${formatCalendarDate(from, today)} – ${formatCalendarDate(to, today)}`;
}

/** The preset a range matches, if any. */
export function matchingPreset(
  presets: readonly PeriodPreset[],
  from: string,
  to: string,
): PeriodPreset | null {
  return presets.find((preset) => preset.from === from && preset.to === to) ?? null;
}

/** Why a custom range cannot be used, or null when it can. */
export function rangeProblem(from: string | null, to: string | null): string | null {
  if (!from || !to) return 'Choose both a start and an end.';
  if (to < from) return 'The end must be on or after the start.';
  if (daysBetween(from, to) + 1 > MAX_PERIOD_DAYS) return 'Choose a range of a year or less.';
  return null;
}
