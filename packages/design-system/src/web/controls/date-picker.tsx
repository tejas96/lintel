'use client';

import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { IconButton } from './button';
import { controlSurface, useField } from './field';

interface DatePickerProps {
  /** Calendar date "YYYY-MM-DD", or null. */
  readonly value: string | null;
  readonly onValueChange: (value: string | null) => void;
  readonly min?: string;
  readonly max?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  /** Accessible name when not inside a Field. */
  readonly label?: string;
  /** Today in the studio time zone, for the "today" mark. */
  readonly today?: string;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const toKey = (date: Date) => format(date, 'yyyy-MM-dd');

function weeksOf(days: readonly Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));
  return weeks;
}

const KEY_STEPS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/** A calendar popover for one date. Arrow keys move by day/week, PageUp/PageDown by month. */
export function DatePicker({
  value,
  onValueChange,
  min,
  max,
  placeholder = 'Pick a date',
  disabled = false,
  label,
  today,
}: DatePickerProps) {
  // A control with its own label stands apart from the surrounding Field.
  const surrounding = useField();
  const field = label ? null : surrounding;
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : null;
  const todayDate = today ? parseISO(today) : new Date();
  const [focusDate, setFocusDate] = useState<Date>(selected ?? todayDate);
  const grid = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (!open) return;
    const key = toKey(focusDate);
    // The popover mounts in a portal; wait a frame so the day buttons exist.
    const frame = window.requestAnimationFrame(() =>
      grid.current?.querySelector<HTMLButtonElement>(`[data-day="${key}"]`)?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [open, focusDate]);

  const outOfRange = (date: Date) => {
    const key = toKey(date);
    return (min !== undefined && key < min) || (max !== undefined && key > max);
  };
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(focusDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(focusDate), { weekStartsOn: 1 }),
  });
  const onGridKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const step = KEY_STEPS[event.key];
    if (step !== undefined) {
      event.preventDefault();
      setFocusDate((current) => addDays(current, step));
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      setFocusDate((current) => addMonths(current, event.key === 'PageUp' ? -1 : 1));
    }
  };
  const pick = (date: Date) => {
    if (outOfRange(date)) return;
    onValueChange(toKey(date));
    setOpen(false);
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setFocusDate(selected ?? todayDate);
        setOpen(next);
      }}
    >
      <PopoverPrimitive.Trigger
        id={field?.id}
        disabled={disabled}
        aria-label={label}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        className={cn(
          controlSurface,
          'flex h-11 items-center gap-2.5 px-3 text-left type-body',
          !selected && 'text-ink-faint',
        )}
      >
        <CalendarDays aria-hidden className="size-4 shrink-0 text-ink-faint" />
        {selected ? format(selected, 'EEE d MMM yyyy') : placeholder}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="lt-pop z-50 w-[19rem] rounded-lg border border-hairline bg-raised p-3 shadow-e3"
        >
          <div className="mb-2 flex items-center justify-between">
            <IconButton
              label="Previous month"
              size="sm"
              onClick={() => setFocusDate((date) => addMonths(date, -1))}
            >
              <ChevronLeft aria-hidden />
            </IconButton>
            <p aria-live="polite" className="type-title-md text-ink">
              {format(focusDate, 'MMMM yyyy')}
            </p>
            <IconButton
              label="Next month"
              size="sm"
              onClick={() => setFocusDate((date) => addMonths(date, 1))}
            >
              <ChevronRight aria-hidden />
            </IconButton>
          </div>
          <table
            aria-label={format(focusDate, 'MMMM yyyy')}
            ref={grid}
            onKeyDown={onGridKeyDown}
            className="w-full border-separate border-spacing-0.5"
          >
            <thead>
              <tr>
                {WEEKDAYS.map((day) => (
                  <th
                    key={day}
                    scope="col"
                    className="py-1 text-center type-label font-medium text-ink-faint"
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeksOf(days).map((week) => (
                <tr key={toKey(week[0] ?? focusDate)}>
                  {week.map((day) => {
                    const isSelected = selected !== null && isSameDay(day, selected);
                    const isToday = isSameDay(day, todayDate);
                    const disabledDay = outOfRange(day);
                    return (
                      <td key={toKey(day)} className="p-0">
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          data-day={toKey(day)}
                          tabIndex={isSameDay(day, focusDate) ? 0 : -1}
                          aria-current={isToday ? 'date' : undefined}
                          aria-label={format(day, 'EEEE d MMMM yyyy')}
                          disabled={disabledDay}
                          onClick={() => pick(day)}
                          className={cn(
                            'relative flex h-10 w-full items-center justify-center rounded-md text-[0.875rem] tabular-nums transition-colors',
                            isSameMonth(day, focusDate) ? 'text-ink' : 'text-ink-faint/70',
                            !isSelected && 'hover:bg-sunken',
                            isSelected && 'bg-accent font-semibold text-on-accent',
                            isToday && !isSelected && 'font-semibold text-accent',
                            disabledDay && 'cursor-not-allowed opacity-35',
                          )}
                        >
                          {format(day, 'd')}
                          {isToday && (
                            <span
                              aria-hidden
                              className={cn(
                                'absolute bottom-1 size-1 rounded-full',
                                isSelected ? 'bg-on-accent' : 'bg-accent',
                              )}
                            />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {value && (
            <button
              type="button"
              onClick={() => {
                onValueChange(null);
                setOpen(false);
              }}
              className="mt-2 w-full rounded-md py-2 type-body-sm text-ink-muted hover:bg-sunken"
            >
              Clear date
            </button>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
