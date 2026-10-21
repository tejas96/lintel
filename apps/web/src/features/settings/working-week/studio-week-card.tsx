'use client';

import type { ManagedWorkingCalendar } from '@lintel/api-contracts';
import { Button, useToast } from '@lintel/design-system/web';
import { weeklyWorkingMinutes } from '@lintel/domain';
import { CalendarClock } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { StaleVersionNotice, useStaleVersion } from '@/features/common/stale-version-notice';
import { isApiError } from '@/lib/api/api-error';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { useWorkingCalendarMutations } from './use-working-calendars';
import { WorkingWeekFields } from './working-week-fields';
import {
  checkWorkingWeek,
  describeWeek,
  formatDuration,
  type WorkingWeekValues,
  weekChangesOf,
  weekOf,
  weekValuesOf,
} from './working-week-form';

interface StudioWeekCardProps {
  readonly calendar: ManagedWorkingCalendar;
  readonly onRefresh: () => void;
}

/** The studio week: what everyone follows unless they have a working week of their own. */
export function StudioWeekCard({ calendar, onRefresh }: StudioWeekCardProps) {
  const toast = useToast();
  const fail = useFailureToast();
  const staleness = useStaleVersion();
  const { update } = useWorkingCalendarMutations();
  const [values, setValues] = useState<WorkingWeekValues>(() => weekValuesOf(calendar));
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const changes = weekChangesOf(calendar, values);
  const dirty = Object.keys(changes).length > 0;
  const preview = weekOf(values);
  const previewValid = Object.keys(checkWorkingWeek(values, false)).length === 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = checkWorkingWeek(values, false);
    setErrors(found);
    if (Object.keys(found).length > 0 || !dirty) return;
    update.mutate(
      { calendar, changes },
      {
        onSuccess: (saved) =>
          toast({ tone: 'success', title: 'Studio week saved', description: describeWeek(saved) }),
        onError: (error) => {
          if (staleness.catchStale(error)) return;
          if (isApiError(error)) setErrors(error.fieldErrors());
          fail(error, 'save the studio week');
        },
      },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-6 rounded-lg border border-hairline bg-raised p-5"
      noValidate
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-on-accent-soft">
            <CalendarClock aria-hidden className="size-4" />
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="type-title-md text-ink">Studio week</h3>
            <p className="type-body-sm text-ink-muted">
              {calendar.peopleCount === 1
                ? '1 person follows'
                : `${calendar.peopleCount} people follow`}{' '}
              it, everyone without a working week of their own.
            </p>
          </div>
        </div>
        <p aria-live="polite" className="font-mono text-[0.8125rem] text-ink-muted">
          {previewValid ? `${formatDuration(weeklyWorkingMinutes(preview))} a week` : '—'}
        </p>
      </div>
      <StaleVersionNotice
        show={staleness.stale}
        message="Someone else changed the studio week while you were editing. Refresh to load it, then make your change again."
        onRefresh={() => {
          staleness.clear();
          onRefresh();
        }}
      />
      <WorkingWeekFields values={values} onChange={setValues} errors={errors} idPrefix="studio" />
      <div className="flex flex-col gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-prose type-body-sm text-ink-faint">
          Capacity, new plans, leave and reminders use the new week straight away. Dates already
          planned stay as they are.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="quiet"
            onClick={() => {
              setValues(weekValuesOf(calendar));
              setErrors({});
            }}
            disabled={!dirty || update.isPending}
          >
            Discard
          </Button>
          <Button
            type="submit"
            variant="primary"
            pending={update.isPending}
            disabled={!dirty || staleness.stale}
          >
            Save studio week
          </Button>
        </div>
      </div>
    </form>
  );
}
