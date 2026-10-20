'use client';

import { easing, useCalmMotion } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { daysBetween } from '@/lib/format/dates';

const WEEKDAY = new Intl.DateTimeFormat('en-IN', { weekday: 'narrow', timeZone: 'UTC' });
const DAY_MS = 86_400_000;

function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * A measured strip of days from today to the due date, drawn like a
 * dimension line on a plan: ticks for each day, the span labelled in days.
 */
export function DueRuler({ today, dueDate }: { readonly today: string; readonly dueDate: string }) {
  const calm = useCalmMotion();
  const span = daysBetween(today, dueDate);
  if (Math.abs(span) > 21) return null;
  const late = span < 0;
  const first = late ? addDays(dueDate, -1) : addDays(today, -1);
  const total = Math.max(7, Math.abs(span) + 3);
  const days = Array.from({ length: total }, (_, index) => addDays(first, index));
  const step = 100 / (total - 1);
  const at = (date: string) => daysBetween(first, date) * step;
  const from = Math.min(at(today), at(dueDate));
  const to = Math.max(at(today), at(dueDate));
  const label =
    span === 0
      ? 'Due today'
      : late
        ? `${Math.abs(span)} ${Math.abs(span) === 1 ? 'day' : 'days'} late`
        : `${span} ${span === 1 ? 'day' : 'days'} left`;

  return (
    <figure className="flex flex-col gap-2" aria-label={label}>
      <div aria-hidden className="relative h-14">
        {span !== 0 && (
          <div className="absolute top-3 h-4" style={{ left: `${from}%`, width: `${to - from}%` }}>
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[0.6875rem] whitespace-nowrap text-on-blueprint">
              {label}
            </span>
            <motion.span
              className="absolute top-2 left-0 h-px w-full origin-left bg-on-blueprint"
              initial={calm ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, ease: easing('inOut'), delay: 0.5 }}
            />
            <span className="absolute top-0 left-0 h-4 w-px rotate-45 bg-on-blueprint" />
            <span className="absolute top-0 right-0 h-4 w-px rotate-45 bg-on-blueprint" />
          </div>
        )}
        <div className="absolute inset-x-0 top-9 h-px bg-on-blueprint/25" />
        {days.map((date) => {
          const isToday = date === today;
          const isDue = date === dueDate;
          return (
            <span
              key={date}
              className="absolute top-7 flex -translate-x-1/2 flex-col items-center gap-1"
              style={{ left: `${at(date)}%` }}
            >
              <span
                className={
                  isToday || isDue
                    ? 'h-4 w-px bg-on-blueprint'
                    : 'h-2 w-px translate-y-1 bg-on-blueprint/40'
                }
              />
              <span
                className={`font-mono text-[0.625rem] ${isToday || isDue ? 'text-on-blueprint' : 'text-on-blueprint-muted/70'}`}
              >
                {isToday ? 'Today' : isDue ? 'Due' : WEEKDAY.format(new Date(`${date}T12:00:00Z`))}
              </span>
            </span>
          );
        })}
      </div>
    </figure>
  );
}
