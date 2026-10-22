/**
 * Audit snapshot values as words: names for ids, dates in words, rupees for
 * `*Minor` amounts, Yes/No, timeline moves as "Task: 14 Nov–27 Nov → …".
 */

import { formatCalendarDate } from '../../lib/format/dates';
import { formatMoney } from '../finances/finance-presentation';
import { fieldLabel } from './audit-presentation';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export type Names = Readonly<Record<string, string>>;
export type Row = Readonly<Record<string, unknown>>;

export const isRow = (value: unknown): value is Row =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const instantFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** One scalar as words: names for ids, human dates, rupees for `*Minor`, Yes/No. */
export function scalarText(field: string, value: unknown, names: Names): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    return /Minor$/.test(field) ? formatMoney(value, 'INR') : value.toLocaleString('en-IN');
  }
  if (typeof value !== 'string') return '—';
  if (value.length === 0) return '(empty)';
  if (UUID.test(value)) return names[value] ?? `Record ${value.slice(0, 8)}`;
  if (CALENDAR_DATE.test(value)) return formatCalendarDate(value);
  if (INSTANT.test(value) && !Number.isNaN(Date.parse(value))) {
    return instantFormat.format(new Date(value));
  }
  return value;
}

/** ["2026-11-14", "2026-11-27"] → "14 Nov–27 Nov". */
function dateRange(value: unknown): string | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [start, end] = value;
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  if (!CALENDAR_DATE.test(start) || !CALENDAR_DATE.test(end)) return null;
  return start === end
    ? formatCalendarDate(start)
    : `${formatCalendarDate(start)}–${formatCalendarDate(end)}`;
}

/** A timeline move: "#7 Civil work: 14 Nov–27 Nov → 14 Nov–25 Nov". */
function moveText(row: Row, names: Names): string | null {
  const from = dateRange(row.from);
  const to = dateRange(row.to);
  if (typeof row.taskId !== 'string' || !from || !to) return null;
  const task = scalarText('taskId', row.taskId, names);
  return `${task}: ${from} → ${to}${row.isDownstream === true ? ' (moved with it)' : ''}`;
}

/** "Label: value · Label: value" for one recorded object. */
function rowText(row: Row, names: Names): string {
  return (
    moveText(row, names) ??
    Object.entries(row)
      .map(([key, value]) => `${fieldLabel(key)}: ${inlineText(key, value, names)}`)
      .join(' · ')
  );
}

/** Any recorded value on one line: lists comma-joined, records as "Label: value · …". */
export function inlineText(field: string, value: unknown, names: Names): string {
  const range = dateRange(value);
  if (range) return range;
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return value.map((item) => inlineText(field, item, names)).join(', ');
  }
  if (isRow(value)) return rowText(value, names);
  return scalarText(field, value, names);
}
