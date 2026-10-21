import type { CapacityOverview } from '@lintel/api-contracts';
import { cn, listItemEnter } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { eachDate, formatLongDate, formatWeekdayShort } from '@/lib/format/dates';
import { CapacityCell } from './capacity-cell';
import { PersonLoad } from './person-load';

interface CapacityGridProps {
  readonly overview: CapacityOverview;
  readonly today: string;
  readonly compact: boolean;
}

/** People down the side, days across the top; each cell is one person's day. */
export function CapacityGrid({ overview, today, compact }: CapacityGridProps) {
  const dates = eachDate(overview.start, overview.end);
  const holidays = new Map(overview.holidays.map((holiday) => [holiday.date, holiday.name]));
  return (
    <section
      aria-label="Capacity by person and day"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the cells hold no controls, so the scrollable grid itself must take focus for keyboard scrolling (WCAG 2.1.1)
      tabIndex={0}
      className="relative overflow-x-auto rounded-lg border border-hairline bg-raised"
    >
      <table className="w-full table-fixed border-separate border-spacing-0">
        <caption className="sr-only">
          Booked work against available time, {formatLongDate(overview.start)} to{' '}
          {formatLongDate(overview.end)}
        </caption>
        <colgroup>
          <col className="w-60" />
          {dates.map((date) => (
            <col key={date} className={compact ? 'w-[3.75rem]' : 'w-[6.5rem]'} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-[2] border-b border-hairline bg-raised px-4 py-2.5 text-left align-bottom type-label font-medium text-ink-faint"
            >
              Person
            </th>
            {dates.map((date) => {
              const holiday = holidays.get(date);
              const isToday = date === today;
              return (
                <th
                  key={date}
                  scope="col"
                  className={cn(
                    'border-b border-l border-hairline px-1.5 pt-2 pb-1.5 text-left align-bottom font-normal',
                    holiday && 'bg-sunken/60',
                    date < today && 'bg-sunken/40',
                  )}
                >
                  <span
                    className={cn(
                      'block text-[0.6875rem]',
                      isToday ? 'text-accent' : 'text-ink-faint',
                    )}
                  >
                    {formatWeekdayShort(date)}
                    {isToday && <span className="sr-only">, today</span>}
                  </span>
                  <span
                    className={cn(
                      'font-display text-[1.125rem] leading-6 tabular-nums',
                      isToday ? 'text-accent' : date < today ? 'text-ink-faint' : 'text-ink',
                    )}
                  >
                    {Number(date.slice(8))}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {overview.people.map((person, index) => (
            <motion.tr key={person.user.id} {...listItemEnter(index)} className="group">
              <th
                scope="row"
                className="sticky left-0 z-[1] border-b border-hairline bg-raised px-4 py-2.5 text-left font-normal group-hover:bg-surface"
              >
                <PersonLoad person={person} />
              </th>
              {person.days.map((day) => {
                const holiday = holidays.get(day.date);
                if (holiday === undefined) {
                  return (
                    <CapacityCell
                      key={day.date}
                      day={day}
                      dateLabel={`${person.user.fullName}, ${formatLongDate(day.date)}`}
                      past={day.date < today}
                      compact={compact}
                    />
                  );
                }
                // A holiday is one band down the whole column, named once.
                return index === 0 ? (
                  <td
                    key={day.date}
                    rowSpan={overview.people.length}
                    className="border-b border-l border-hairline bg-sunken/60 p-0 text-center align-middle"
                  >
                    <span className="inline-block rotate-180 py-4 text-[0.75rem] tracking-wide text-ink-muted [writing-mode:vertical-rl]">
                      {holiday}, studio closed
                    </span>
                  </td>
                ) : null;
              })}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
