'use client';

import { Checkbox } from '@lintel/design-system/web';
import { CalendarCheck, TriangleAlert } from 'lucide-react';
import { daysBetween, formatCalendarDate } from '@/lib/format/dates';

/**
 * Whether the new work ends after the planned delivery date. The planned end
 * only moves when the manager ticks it; the agreed baseline never moves.
 */
export function EndDateImpact({
  plannedEndDate,
  forecastEndDate,
  today,
  extend,
  onExtendChange,
}: {
  readonly plannedEndDate: string;
  readonly forecastEndDate: string | null;
  readonly today: string;
  readonly extend: boolean;
  readonly onExtendChange: (extend: boolean) => void;
}) {
  const late = forecastEndDate !== null && forecastEndDate > plannedEndDate;
  const days = late && forecastEndDate ? daysBetween(plannedEndDate, forecastEndDate) : 0;
  return (
    <section
      className="flex flex-col gap-3 border-t border-hairline pt-4"
      aria-label="Delivery date"
    >
      <h3 className="type-label text-ink-muted">Delivery date</h3>
      {late && forecastEndDate ? (
        <>
          <p className="flex items-start gap-2 type-body-sm text-ink">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-at-risk" />
            <span>
              <span className="font-medium text-at-risk">At risk: </span>
              open work would end {formatCalendarDate(forecastEndDate, today)}, {days}{' '}
              {days === 1 ? 'day' : 'days'} after the planned end (
              {formatCalendarDate(plannedEndDate, today)}).
            </span>
          </p>
          <Checkbox
            checked={extend}
            onCheckedChange={onExtendChange}
            label={`Move the planned end to ${formatCalendarDate(forecastEndDate, today)}`}
            description="Leave it unticked to keep the date and plan the extra work another way. The date agreed at the start never changes."
          />
        </>
      ) : (
        <p className="flex items-start gap-2 type-body-sm text-ink-muted">
          <CalendarCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-on-track" />
          The planned end ({formatCalendarDate(plannedEndDate, today)}) does not move.
        </p>
      )}
    </section>
  );
}
