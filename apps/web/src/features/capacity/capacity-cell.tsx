import { cn, StatusGlyph } from '@lintel/design-system/web';
import { LoadBar } from './load-bar';
import {
  type CapacityDay,
  describeDay,
  formatHoursShort,
  LOAD_PRESENTATION,
} from './load-presentation';

interface CapacityCellProps {
  readonly day: CapacityDay;
  readonly dateLabel: string;
  /** Days before today: kept for context, quieter. */
  readonly past: boolean;
  /** Fortnight view: hours only, no "of 8h". */
  readonly compact: boolean;
}

/** One person on one working day: booked hours, the load bar, and leave. */
export function CapacityCell({ day, dateLabel, past, compact }: CapacityCellProps) {
  const description = describeDay(day, dateLabel, null);
  const booked = day.confirmedMinutes + day.tentativeMinutes + day.blockedMinutes;
  const closed = !day.isWorkingDay && booked === 0;
  const presentation = LOAD_PRESENTATION[day.status];
  const fullLeave = day.leave === 'approved' && day.availableMinutes === 0 && booked === 0;
  return (
    <td
      className={cn(
        'relative h-16 border-b border-l border-hairline p-0 align-top',
        closed && 'bg-sunken/60',
        day.leave === 'approved' && 'lt-hatch',
      )}
    >
      <span className="sr-only">{description}</span>
      {!closed && (
        <div
          aria-hidden
          className={cn('flex h-full flex-col justify-between gap-1.5', compact ? 'p-1.5' : 'p-2')}
        >
          <div className="flex items-start justify-between gap-1">
            {fullLeave ? (
              <span className="text-[0.75rem] font-medium text-ink-muted">Leave</span>
            ) : (
              <span
                className={cn(
                  'text-[0.8125rem] leading-4 tabular-nums',
                  // Past days are quieter through colour, never opacity (text contrast).
                  booked === 0 || past ? 'text-ink-faint' : 'font-medium text-ink',
                )}
              >
                {formatHoursShort(day.confirmedMinutes)}
                {!compact && (
                  <span className="font-normal text-ink-faint">
                    {' '}
                    / {formatHoursShort(day.availableMinutes)}
                  </span>
                )}
              </span>
            )}
            {(day.status === 'stretched' || day.status === 'overloaded') && (
              <StatusGlyph name={presentation.glyph} className={cn('size-3', presentation.text)} />
            )}
          </div>
          {day.leave === 'pending' && (
            <span className="text-[0.6875rem] leading-3 text-ink-muted">Leave asked</span>
          )}
          {!fullLeave && (
            <div className={past ? 'opacity-55' : undefined}>
              <LoadBar day={day} />
            </div>
          )}
        </div>
      )}
      {day.leave === 'pending' && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-1 rounded-md border border-dashed border-ink-faint/70"
        />
      )}
    </td>
  );
}
