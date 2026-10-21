'use client';

import type { ManagedLeaveType } from '@lintel/api-contracts';
import { Button, Sheet, useToast } from '@lintel/design-system/web';
import { type FormEvent, useState } from 'react';
import { StaleVersionNotice, useStaleVersion } from '@/features/common/stale-version-notice';
import { isApiError } from '@/lib/api/api-error';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { LeaveTypeFields } from './leave-type-fields';
import {
  checkLeaveType,
  definitionOf,
  emptyLeaveType,
  type LeaveTypeFormValues,
  leaveTypeChangesOf,
  leaveTypeValuesOf,
} from './leave-type-form';
import { useLeavePolicyMutations } from './use-leave-policies';

/** What the sheet is doing: adding (with the next free colour) or editing one type. */
export type LeaveTypeSheetMode =
  | { readonly kind: 'add'; readonly colorIndex: number }
  | { readonly kind: 'edit'; readonly type: ManagedLeaveType };

interface LeaveTypeSheetProps {
  readonly mode: LeaveTypeSheetMode | null;
  readonly onClose: () => void;
  readonly onRefresh: () => void;
}

export function LeaveTypeSheet({ mode, onClose, onRefresh }: LeaveTypeSheetProps) {
  return (
    <Sheet
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      autoFocusField
      title={mode?.kind === 'edit' ? `Edit ${mode.type.name}` : 'Add a leave type'}
      description="The rules here guide requests; they never refuse leave on their own."
    >
      {mode && (
        <LeaveTypeForm
          key={mode.kind === 'edit' ? `${mode.type.id}:${mode.type.version}` : 'add'}
          mode={mode}
          onDone={onClose}
          onRefresh={onRefresh}
        />
      )}
    </Sheet>
  );
}

function LeaveTypeForm({
  mode,
  onDone,
  onRefresh,
}: {
  readonly mode: LeaveTypeSheetMode;
  readonly onDone: () => void;
  readonly onRefresh: () => void;
}) {
  const toast = useToast();
  const fail = useFailureToast();
  const staleness = useStaleVersion();
  const { create, update } = useLeavePolicyMutations();
  const [values, setValues] = useState<LeaveTypeFormValues>(() =>
    mode.kind === 'edit' ? leaveTypeValuesOf(mode.type) : emptyLeaveType(mode.colorIndex),
  );
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const changes = mode.kind === 'edit' ? leaveTypeChangesOf(mode.type, values) : null;
  const pending = create.isPending || update.isPending;
  const onError = (error: unknown) => {
    if (staleness.catchStale(error)) return;
    if (isApiError(error)) setErrors(error.fieldErrors());
    fail(error, mode.kind === 'edit' ? 'save the leave type' : 'add the leave type');
  };
  const onSaved = (saved: ManagedLeaveType) => {
    toast({
      tone: 'success',
      title: mode.kind === 'edit' ? 'Leave type saved' : 'Leave type added',
      description: saved.name,
    });
    onDone();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = checkLeaveType(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (mode.kind === 'add') {
      create.mutate(definitionOf(values), { onSuccess: onSaved, onError });
    } else if (changes && Object.keys(changes).length > 0) {
      update.mutate({ type: mode.type, changes }, { onSuccess: onSaved, onError });
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-7 p-5 sm:p-6" noValidate>
      <StaleVersionNotice
        show={staleness.stale}
        message="Someone else changed this leave type while you were editing. Refresh to load their version, then make your change again."
        onRefresh={() => {
          staleness.clear();
          onRefresh();
        }}
      />
      <LeaveTypeFields values={values} onChange={setValues} errors={errors} />
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
          {mode.kind === 'edit' ? 'Save changes' : 'Add leave type'}
        </Button>
      </div>
    </form>
  );
}
