'use client';

import { easing, useCalmMotion } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { formatTimeOfDay } from '@/lib/format/task-due';

/** Minutes after midnight, now, in the studio's timezone. */
function studioMinutes(timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return value('hour') * 60 + value('minute');
}

function useStudioMinutes(timeZone: string): number {
  const [minutes, setMinutes] = useState(() => studioMinutes(timeZone));
  useEffect(() => {
    const timer = window.setInterval(() => setMinutes(studioMinutes(timeZone)), 30_000);
    return () => window.clearInterval(timer);
  }, [timeZone]);
  return minutes;
}

function spanText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * Today's ruler when the task is due at a set time: the day measured in
 * hours, "Now" and "Due" marked, the gap between them dimensioned like a
 * drawing — time left, or how late it is.
 */
export function DueHoursRuler({ dueTime }: { readonly dueTime: string }) {
  const calm = useCalmMotion();
  const { user } = useSession();
  const now = useStudioMinutes(user.timeZone);
  const [dueHour = 0, dueMinute = 0] = dueTime.split(':').map(Number);
  const due = dueHour * 60 + dueMinute;
  const firstHour = Math.max(0, Math.floor(Math.min(now, due) / 60) - 1);
  const lastHour = Math.min(24, Math.max(Math.ceil(Math.max(now, due) / 60) + 1, firstHour + 6));
  const at = (minutes: number) =>
    ((minutes - firstHour * 60) / ((lastHour - firstHour) * 60)) * 100;
  const late = now > due;
  const label = late ? `${spanText(now - due)} late` : `${spanText(due - now)} left`;
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, index) => firstHour + index);
  const marks = [
    { key: 'now', minutes: now, text: 'Now' },
    { key: 'due', minutes: due, text: `Due ${formatTimeOfDay(dueTime)}` },
  ].sort((left, right) => left.minutes - right.minutes);
  const from = Math.min(at(now), at(due));
  const to = Math.max(at(now), at(due));
  return (
    <figure
      className="flex flex-col gap-2"
      aria-label={`Due at ${formatTimeOfDay(dueTime)} today, ${label}`}
    >
      <div aria-hidden className="relative h-[4.75rem]">
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
        <div className="absolute inset-x-0 top-9 h-px bg-on-blueprint/25" />
        {hours.map((hour) => (
          <span
            key={hour}
            className="absolute top-8 flex -translate-x-1/2 flex-col items-center gap-1"
            style={{ left: `${at(hour * 60)}%` }}
          >
            <span className="h-2 w-px bg-on-blueprint/40" />
            {/* An hour right under "Now" or "Due" stays a tick only: the mark's line passes there. */}
            {marks.every((mark) => Math.abs(at(hour * 60) - at(mark.minutes)) > 4) && (
              <span className="font-mono text-[0.625rem] text-on-blueprint-muted/70">
                {hour % 12 === 0 ? 12 : hour % 12}
              </span>
            )}
          </span>
        ))}
        {marks.map((mark, index) => (
          <span key={mark.key}>
            <span
              className="absolute top-7 h-[1.9rem] w-px -translate-x-1/2 bg-on-blueprint"
              style={{ left: `${at(mark.minutes)}%` }}
            />
            {/* The earlier mark's label hangs left of its tick, the later one's right: never overlapping. */}
            <span
              className={`absolute top-[3.6rem] font-mono text-[0.625rem] whitespace-nowrap text-on-blueprint ${index === 0 ? 'pr-1 text-right' : 'pl-1'}`}
              style={
                index === 0
                  ? { right: `${100 - at(mark.minutes)}%` }
                  : { left: `${at(mark.minutes)}%` }
              }
            >
              {mark.text}
            </span>
          </span>
        ))}
      </div>
    </figure>
  );
}
