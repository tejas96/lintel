const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const monthOf = (date: string) => MONTHS[Number(date.slice(5, 7)) - 1] ?? '';

/** "October 2026", or "October to December 2026" for a quarter. */
export function rewardPeriodWords(start: string, end: string): string {
  const from = monthOf(start);
  const to = monthOf(end);
  return from === to ? `${from} ${end.slice(0, 4)}` : `${from} to ${to} ${end.slice(0, 4)}`;
}
