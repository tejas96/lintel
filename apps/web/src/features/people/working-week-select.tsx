'use client';

import { Field, Select } from '@lintel/design-system/web';
import { useWorkingCalendars } from '@/features/settings/working-week/use-working-calendars';
import { describeWeek } from '@/features/settings/working-week/working-week-form';

/** The form's value for "follows the studio week" (stored as no working week of their own). */
export const STUDIO_WEEK = 'studio';

/** The working week the API should store: null follows the studio week. */
export function workingCalendarIdOf(value: string): string | null {
  return value === STUDIO_WEEK ? null : value;
}

interface WorkingWeekSelectProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly error?: string | undefined;
}

/** Which working week a person follows; capacity and leave days are counted on it. */
export function WorkingWeekSelect({ value, onValueChange, error }: WorkingWeekSelectProps) {
  const calendars = useWorkingCalendars();
  const studio = calendars.data?.find((calendar) => calendar.isDefault);
  const others = calendars.data?.filter((calendar) => !calendar.isDefault) ?? [];
  const shown = value === studio?.id ? STUDIO_WEEK : value;
  const options = [
    {
      value: STUDIO_WEEK,
      label: 'Studio week',
      ...(studio ? { description: describeWeek(studio) } : {}),
    },
    ...others.map((calendar) => ({
      value: calendar.id,
      label: calendar.name,
      description: describeWeek(calendar),
    })),
  ];
  return (
    <Field
      label="Working week"
      hint={
        others.length === 0
          ? 'Everyone follows the studio week. Add others under Settings, Working week.'
          : 'Capacity and leave days are counted on this week.'
      }
      error={error}
    >
      <Select
        value={shown}
        onValueChange={onValueChange}
        options={options}
        disabled={!calendars.data || others.length === 0}
      />
    </Field>
  );
}
