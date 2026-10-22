import { daysFrom, shortDate } from '../lib/calendar-math';

/**
 * What a screen reader hears for a task bar: "Present the concept, Ready,
 * 29 Oct, 1 day" or "Working drawings, Ready, 30 Oct – 6 Nov, 8 days".
 */
export function ganttBarLabel(
  title: string,
  statusLabel: string,
  start: string,
  end: string,
): string {
  const days = daysFrom(start, end) + 1;
  const dates = start === end ? shortDate(start) : `${shortDate(start)} – ${shortDate(end)}`;
  return `${title}, ${statusLabel}, ${dates}, ${days} ${days === 1 ? 'day' : 'days'}`;
}
