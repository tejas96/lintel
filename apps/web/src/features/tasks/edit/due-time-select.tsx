'use client';

import { Select } from '@lintel/design-system/web';
import { Clock } from 'lucide-react';
import { formatTimeOfDay } from '@/lib/format/task-due';

const END_OF_DAY = 'end';

/** Every half hour from 07:00 to 21:00: the hours studios set deadlines in. */
const HALF_HOURS = Array.from({ length: 29 }, (_, index) => {
  const minutes = 7 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${minutes % 60 === 0 ? '00' : '30'}`;
});

interface DueTimeSelectProps {
  readonly value: string | null;
  readonly onValueChange: (time: string | null) => void;
  readonly disabled?: boolean | undefined;
  readonly className?: string | undefined;
}

/**
 * The optional time a task is due, in the studio's timezone. "End of the
 * working day" (no time) is the default; a time set elsewhere that is not on
 * the half-hour list stays selectable.
 */
export function DueTimeSelect({ value, onValueChange, disabled, className }: DueTimeSelectProps) {
  const times = value && !HALF_HOURS.includes(value) ? [...HALF_HOURS, value].sort() : HALF_HOURS;
  return (
    <Select
      label="Due time"
      value={value ?? END_OF_DAY}
      disabled={disabled ?? false}
      {...(className ? { className } : {})}
      onValueChange={(next) => onValueChange(next === END_OF_DAY ? null : next)}
      options={[
        { value: END_OF_DAY, label: 'End of day' },
        ...times.map((time) => ({
          value: time,
          label: formatTimeOfDay(time),
          icon: <Clock aria-hidden className="size-4 text-ink-faint" />,
        })),
      ]}
    />
  );
}
