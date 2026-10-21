'use client';

import { cn, Field, Input } from '@lintel/design-system/web';
import { WEEKDAY_NAMES } from '@lintel/domain';
import { Check } from 'lucide-react';
import { breakNote, type WorkingWeekValues } from './working-week-form';

interface WorkingWeekFieldsProps {
  readonly values: WorkingWeekValues;
  readonly onChange: (values: WorkingWeekValues) => void;
  readonly errors: Readonly<Record<string, string>>;
  /** Other weeks have a name; the studio week is always "the studio week". */
  readonly withName?: boolean;
  readonly idPrefix: string;
}

/** Which days, when the day runs, and how much of it is work. */
export function WorkingWeekFields({
  values,
  onChange,
  errors,
  withName = false,
  idPrefix,
}: WorkingWeekFieldsProps) {
  const set = <K extends keyof WorkingWeekValues>(key: K, value: WorkingWeekValues[K]) =>
    onChange({ ...values, [key]: value });
  const toggle = (day: number) =>
    set(
      'workingWeekdays',
      values.workingWeekdays.includes(day)
        ? values.workingWeekdays.filter((candidate) => candidate !== day)
        : [...values.workingWeekdays, day],
    );
  const note = breakNote(values);
  const daysError = errors.workingWeekdays;
  return (
    <div className="flex flex-col gap-5">
      {withName && (
        <Field label="Name" error={errors.name} required>
          <Input
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
            maxLength={60}
            placeholder="For example: Site team or Part time"
          />
        </Field>
      )}
      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={daysError ? `${idPrefix}-days-error` : undefined}
      >
        <legend className="mb-2 type-label text-ink-muted">Working days</legend>
        <div className="grid grid-cols-7 gap-1.5 sm:flex sm:flex-wrap">
          {WEEKDAY_NAMES.map((name, index) => {
            const day = index + 1;
            const on = values.workingWeekdays.includes(day);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                aria-label={name}
                onClick={() => toggle(day)}
                className={cn(
                  'flex h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border px-2 transition-colors sm:w-16',
                  on
                    ? 'border-accent bg-accent-soft text-on-accent-soft'
                    : 'border-hairline bg-raised text-ink-muted hover:border-rule hover:text-ink',
                )}
              >
                <span className="type-body-sm font-medium">{name.slice(0, 3)}</span>
                <Check aria-hidden className={cn('size-3', on ? 'opacity-100' : 'opacity-0')} />
              </button>
            );
          })}
        </div>
        {daysError && (
          <p id={`${idPrefix}-days-error`} role="alert" className="type-body-sm text-overdue">
            {daysError}
          </p>
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Day starts" error={errors.dayStartTime}>
          <Input
            type="time"
            value={values.dayStartTime}
            onChange={(event) => set('dayStartTime', event.target.value)}
          />
        </Field>
        <Field label="Day ends" error={errors.dayEndTime}>
          <Input
            type="time"
            value={values.dayEndTime}
            onChange={(event) => set('dayEndTime', event.target.value)}
          />
        </Field>
        <Field
          label="Work a day"
          hint={errors.workingMinutesPerDay ? undefined : (note ?? 'Hours, without breaks.')}
          error={errors.workingMinutesPerDay}
        >
          <Input
            inputMode="decimal"
            value={values.workingHours}
            onChange={(event) => set('workingHours', event.target.value)}
            trailing={<span className="pr-1">hours</span>}
          />
        </Field>
      </div>
    </div>
  );
}
