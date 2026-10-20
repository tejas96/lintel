import type { CapacityOverview, PersonCapacity } from '@lintel/api-contracts';
import { cn, listItemEnter } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { formatLongDate, formatWeekdayShort } from '@/lib/format/dates';
import { LoadBar } from './load-bar';
import { describeDay } from './load-presentation';
import { PersonLoad } from './person-load';

interface CapacityPersonCardProps {
  readonly person: PersonCapacity;
  readonly holidays: CapacityOverview['holidays'];
  readonly today: string;
  readonly index: number;
}

/** Phones: one card per person, the days as a row of upright bars. */
export function CapacityPersonCard({ person, holidays, today, index }: CapacityPersonCardProps) {
  const closedOn = new Map(holidays.map((holiday) => [holiday.date, holiday.name]));
  return (
    <motion.li
      {...listItemEnter(index)}
      className="flex flex-col gap-4 rounded-lg border border-hairline bg-raised p-4"
    >
      <PersonLoad person={person} />
      <ol className="flex items-end justify-between gap-1">
        {person.days.map((day) => {
          const holiday = closedOn.get(day.date) ?? null;
          const booked = day.confirmedMinutes + day.tentativeMinutes + day.blockedMinutes;
          const closed = holiday !== null || (!day.isWorkingDay && booked === 0);
          return (
            <li key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="sr-only">{describeDay(day, formatLongDate(day.date), holiday)}</span>
              <span
                aria-hidden
                className={cn(
                  'relative flex h-12 w-full items-end justify-center rounded-[5px]',
                  day.leave === 'approved' && 'lt-hatch',
                  day.leave === 'pending' && 'border border-dashed border-ink-faint/70',
                )}
              >
                {closed ? (
                  <span className="h-10 w-1.5 rounded-full border border-dashed border-rule" />
                ) : (
                  <LoadBar day={day} orientation="vertical" className="h-10" />
                )}
              </span>
              <span
                aria-hidden
                className={cn(
                  'text-[0.625rem] leading-3',
                  day.date === today ? 'font-semibold text-accent' : 'text-ink-faint',
                )}
              >
                {formatWeekdayShort(day.date).slice(0, 1)}
                <span className="block text-center tabular-nums">{Number(day.date.slice(8))}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </motion.li>
  );
}
