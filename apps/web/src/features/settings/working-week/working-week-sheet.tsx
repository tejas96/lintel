'use client';

import type { ManagedWorkingCalendar } from '@lintel/api-contracts';
import { Button, Sheet, useToast } from '@lintel/design-system/web';
import { type FormEvent, useState } from 'react';
import { StaleVersionNotice, useStaleVersion } from '@/features/common/stale-version-notice';
import { isApiError } from '@/lib/api/api-error';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { useWorkingCalendarMutations } from './use-working-calendars';
import { WorkingWeekFields } from './working-week-fields';
import {
  checkWorkingWeek,
  emptyWorkingWeek,
  type WorkingWeekValues,
  weekChangesOf,
  weekOf,
  weekValuesOf,
} from './working-week-form';

/** null: closed; 'add': a new week; a calendar: editing that week. */
export type WorkingWeekSheetMode = 'add' | ManagedWorkingCalendar | null;

interface WorkingWeekSheetProps {
  readonly mode: WorkingWeekSheetMode;
  readonly onClose: () => void;
  readonly onRefresh: () => void;
}

/** Add or edit a working week for people who do not follow the studio week. */
export function WorkingWeekSheet({ mode, onClose, onRefresh }: WorkingWeekSheetProps) {
  return (
    <Sheet
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      autoFocusField
      title={mode === 'add' || mode === null ? 'Add a working week' : `Edit ${mode.name}`}
      description="For part-timers or a site team. Assign people to it under People."
    >
      {mode !== null && (
        <WorkingWeekForm
          key={mode === 'add' ? 'add' : `${mode.id}:${mode.version}`}
          calendar={mode === 'add' ? null : mode}
          onDone={onClose}
          onRefresh={onRefresh}
        />
      )}
    </Sheet>
  );
}

function WorkingWeekForm({
  calendar,
  onDone,
  onRefresh,
}: {
  readonly calendar: ManagedWorkingCalendar | null;
  readonly onDone: () => void;
  readonly onRefresh: () => void;
}) {
  const toast = useToast();
  const fail = useFailureToast();
  const staleness = useStaleVersion();
  const { create, update } = useWorkingCalendarMutations();
  const [values, setValues] = useState<WorkingWeekValues>(() =>
    calendar ? weekValuesOf(calendar) : emptyWorkingWeek(),
  );
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const changes = calendar ? weekChangesOf(calendar, values) : null;
  const pending = create.isPending || update.isPending;
  const onError = (error: unknown) => {
    if (staleness.catchStale(error)) return;
    if (isApiError(error)) setErrors(error.fieldErrors());
    fail(error, calendar ? 'save the working week' : 'add the working week');
  };
  const onSaved = (saved: ManagedWorkingCalendar) => {
    toast({
      tone: 'success',
      title: calendar ? 'Working week saved' : 'Working week added',
      description: saved.name,
    });
    onDone();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = checkWorkingWeek(values, true);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (!calendar) create.mutate(weekOf(values), { onSuccess: onSaved, onError });
    else if (changes && Object.keys(changes).length > 0) {
      update.mutate({ calendar, changes }, { onSuccess: onSaved, onError });
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-7 p-5 sm:p-6" noValidate>
      <StaleVersionNotice
        show={staleness.stale}
        message="Someone else changed this working week while you were editing. Refresh to load it, then make your change again."
        onRefresh={() => {
          staleness.clear();
          onRefresh();
        }}
      />
      <WorkingWeekFields
        values={values}
        onChange={setValues}
        errors={errors}
        withName
        idPrefix="sheet"
      />
      <div className="flex justify-end gap-2 border-t border-hairline pt-5">
        <Button variant="quiet" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          pending={pending}
          disabled={staleness.stale || (changes !== null && Object.keys(changes).length === 0)}
        >
          {calendar ? 'Save changes' : 'Add working week'}
        </Button>
      </div>
    </form>
  );
}
