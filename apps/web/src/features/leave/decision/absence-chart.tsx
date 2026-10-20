import type { LeaveRequestDetail } from '@lintel/api-contracts';
import { Avatar, cn } from '@lintel/design-system/web';
import {
  addDays,
  eachDate,
  formatCalendarDate,
  formatMonthShort,
  formatWeekdayShort,
} from '@/lib/format/dates';

interface AbsenceChartProps {
  readonly request: LeaveRequestDetail;
  readonly today: string;
}

interface ChartRow {
  readonly id: string;
  readonly name: string;
  readonly hue: number;
  readonly note: string;
  /** Date → what that day is for this person. */
  readonly days: ReadonlyMap<string, 'leave' | 'half' | 'approved' | 'pending'>;
  readonly subject: boolean;
}

const CELL_WORDS = {
  leave: 'On leave',
  half: 'Half day of leave',
  approved: 'Away, approved',
  pending: 'Away, waiting for approval',
  off: 'Not a working day',
  free: 'Working',
  outside: 'Outside the request',
} as const;

function rowsOf(request: LeaveRequestDetail): ChartRow[] {
  const subjectDays = new Map(
    request.impact.days.map((day) => [day.date, day.halfDayUnits >= 2 ? 'leave' : 'half'] as const),
  );
  const subject: ChartRow = {
    id: request.user.id,
    name: request.user.fullName,
    hue: request.user.avatarHue,
    note: request.durationLabel,
    days: subjectDays,
    subject: true,
  };
  const others = request.impact.overlappingAbsences.map<ChartRow>((absence) => {
    const kind = absence.status === 'approved' ? 'approved' : 'pending';
    return {
      id: absence.user.id,
      name: absence.user.fullName,
      hue: absence.user.avatarHue,
      note: kind === 'approved' ? 'Approved' : 'Waiting for approval',
      days: new Map(absence.dates.map((date) => [date, kind] as const)),
      subject: false,
    };
  });
  return [subject, ...others];
}

/**
 * The leave on a strip of days: the requester's working days hatched, days
 * that are not working days in grey, and teammates already away beneath.
 */
/** At least a week of columns, so a short leave still reads as days in context. */
const MIN_COLUMNS = 7;

export function AbsenceChart({ request, today }: AbsenceChartProps) {
  const length = eachDate(request.startDate, request.endDate).length;
  const padding = Math.max(0, MIN_COLUMNS - length);
  const before = Math.floor(padding / 2);
  const dates = eachDate(
    addDays(request.startDate, -before),
    addDays(request.endDate, padding - before),
  );
  const inside = (date: string) => date >= request.startDate && date <= request.endDate;
  const rows = rowsOf(request);
  const workingDays = new Set(request.impact.days.map((day) => day.date));
  const halfSide = request.dayPortion === 'second_half' ? 'right' : 'left';
  return (
    <div className="relative overflow-x-auto rounded-lg border border-hairline bg-raised">
      <table className="w-full border-separate border-spacing-0">
        <caption className="sr-only">
          Who is away from {formatCalendarDate(request.startDate, today)} to{' '}
          {formatCalendarDate(request.endDate, today)}
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-[1] w-32 min-w-32 sm:w-40 sm:min-w-36 border-b border-hairline bg-raised px-4 py-2.5 text-left type-label text-ink-faint"
            >
              {formatMonthShort(request.startDate)}
            </th>
            {dates.map((date) => (
              <th
                key={date}
                scope="col"
                className={cn(
                  'min-w-11 border-b border-l border-hairline px-1 py-2 text-center font-normal',
                  !inside(date) && 'opacity-50',
                )}
              >
                <span className="block text-[0.6875rem] text-ink-faint">
                  {formatWeekdayShort(date).slice(0, 2)}
                </span>
                <span
                  className={cn(
                    'font-display text-[1.0625rem] tabular-nums',
                    date === today ? 'text-accent' : 'text-ink',
                  )}
                >
                  {Number(date.slice(8))}
                </span>
                {date === today && <span className="sr-only"> (today)</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th
                scope="row"
                className="sticky left-0 z-[1] border-b border-hairline bg-raised px-4 py-2 text-left font-normal last:border-b-0"
              >
                <span className="flex items-center gap-2.5">
                  <Avatar name={row.name} hue={row.hue} size="xs" decorative />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate type-body-sm font-medium text-ink">{row.name}</span>
                    <span className="truncate text-[0.75rem] text-ink-faint">{row.note}</span>
                  </span>
                </span>
              </th>
              {dates.map((date) => {
                const kind = row.days.get(date);
                const outside = !inside(date);
                const off = !outside && !workingDays.has(date) && kind === undefined;
                return (
                  <td
                    key={date}
                    className={cn(
                      'h-12 border-b border-l border-hairline p-1',
                      off && 'bg-sunken/60',
                    )}
                  >
                    <span className="sr-only">
                      {CELL_WORDS[kind ?? (outside ? 'outside' : off ? 'off' : 'free')]}
                    </span>
                    {kind && <DayMark kind={kind} subject={row.subject} halfSide={halfSide} />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayMark({
  kind,
  subject,
  halfSide,
}: {
  readonly kind: 'leave' | 'half' | 'approved' | 'pending';
  readonly subject: boolean;
  readonly halfSide: 'left' | 'right';
}) {
  if (kind === 'pending') {
    return (
      <span
        aria-hidden
        className="block h-full rounded-[5px] border border-dashed border-ink-faint"
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'lt-hatch block h-full rounded-[5px]',
        subject ? 'border border-accent/40 bg-accent-soft' : 'bg-sunken',
        kind === 'half' && 'w-1/2',
        kind === 'half' && halfSide === 'right' && 'ml-auto',
      )}
    />
  );
}
