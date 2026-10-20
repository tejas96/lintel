'use client';

import type { LeaveType } from '@lintel/api-contracts';
import { DatePicker, Field, SegmentedControl, Select } from '@lintel/design-system/web';
import type { DayPortion } from '@lintel/domain';
import { useState } from 'react';
import type { LeavePeriodInput } from './use-leave';

const PORTIONS = [
  { value: 'full', label: 'Full day' },
  { value: 'first_half', label: 'Morning' },
  { value: 'second_half', label: 'Afternoon' },
] as const satisfies readonly { value: DayPortion; label: string }[];

/** The type, days and part of the day for a leave period, and the period they make. */
export function useLeavePeriodForm(types: readonly LeaveType[]) {
  const active = types.filter((type) => type.isActive);
  const [typeId, setTypeId] = useState<string | undefined>(active[0]?.id);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [dayPortion, setDayPortion] = useState<DayPortion>('full');
  const type = active.find((candidate) => candidate.id === typeId);
  const end = endDate ?? startDate;
  const singleDay = startDate !== null && end === startDate;
  const period: LeavePeriodInput | null =
    typeId && startDate && end && end >= startDate
      ? {
          leaveTypeId: typeId,
          startDate,
          endDate: end,
          dayPortion: singleDay ? dayPortion : 'full',
        }
      : null;
  const reset = () => {
    setStartDate(null);
    setEndDate(null);
    setDayPortion('full');
  };
  return {
    active,
    type,
    period,
    singleDay,
    reset,
    state: { typeId, startDate, endDate, dayPortion },
    set: { setTypeId, setStartDate, setEndDate, setDayPortion },
  };
}

type LeavePeriodForm = ReturnType<typeof useLeavePeriodForm>;

interface LeavePeriodFieldsProps {
  readonly form: LeavePeriodForm;
  readonly today: string;
  /** Earliest day that can be chosen; absences may start in the past. */
  readonly earliest?: string;
}

export function LeavePeriodFields({ form, today, earliest }: LeavePeriodFieldsProps) {
  const { state, set, active, type } = form;
  const lastDayMinimum = state.startDate ?? earliest;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type of leave" hint={type?.description ?? undefined}>
          <Select
            value={state.typeId}
            onValueChange={set.setTypeId}
            options={active.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
          />
        </Field>
        <div className="hidden sm:block" />
        <Field label="First day" required>
          <DatePicker
            value={state.startDate}
            onValueChange={(value) => {
              set.setStartDate(value);
              if (value && state.endDate && state.endDate < value) set.setEndDate(null);
            }}
            {...(earliest ? { min: earliest } : {})}
            today={today}
          />
        </Field>
        <Field label="Last day" hint="Leave empty for a single day.">
          <DatePicker
            value={state.endDate}
            onValueChange={set.setEndDate}
            {...(lastDayMinimum ? { min: lastDayMinimum } : {})}
            today={today}
          />
        </Field>
      </div>
      {form.singleDay && type?.allowsHalfDay && (
        <SegmentedControl
          label="Which part of the day"
          value={state.dayPortion}
          onValueChange={set.setDayPortion}
          options={PORTIONS}
          size="sm"
          className="self-start"
        />
      )}
    </div>
  );
}
