import { formatMoney } from '@/features/finances/finance-presentation';
import { formatCalendarDate } from '@/lib/format/dates';
import { fieldLabel } from './audit-presentation';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

type Names = Readonly<Record<string, string>>;
type Row = Readonly<Record<string, unknown>>;

const isRow = (value: unknown): value is Row =>
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

function inlineText(field: string, value: unknown, names: Names): string {
  const range = dateRange(value);
  if (range) return range;
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return value.map((item) => inlineText(field, item, names)).join(', ');
  }
  if (isRow(value)) return rowText(value, names);
  return scalarText(field, value, names);
}

/** A recorded value as readable text; lists of records as a list, never raw JSON. */
export function AuditValue({
  field,
  value,
  names,
}: {
  readonly field: string;
  readonly value: unknown;
  readonly names: Names;
}) {
  if (Array.isArray(value) && value.some(isRow)) {
    return (
      <ul className="flex flex-col gap-1">
        {value.map((item, index) => (
          // Recorded lists never reorder; the position is the identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: static snapshot
          <li key={index}>{inlineText(field, item, names)}</li>
        ))}
      </ul>
    );
  }
  if (isRow(value)) {
    return (
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
        {Object.entries(value).map(([key, item]) => (
          <div key={key} className="contents">
            <dt className="text-ink-faint">{fieldLabel(key)}</dt>
            <dd>{inlineText(key, item, names)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return <>{inlineText(field, value, names)}</>;
}
