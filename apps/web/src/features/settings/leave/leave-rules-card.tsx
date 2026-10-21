'use client';

import type { LeaveRules } from '@lintel/api-contracts';
import { Button, Field, Input, useToast } from '@lintel/design-system/web';
import { SECOND_APPROVAL_THRESHOLD_LIMITS } from '@lintel/domain';
import { Stamp } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { formatHalfDays } from '@/features/leave/use-leave';
import { isApiError } from '@/lib/api/api-error';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { useLeavePolicyMutations } from './use-leave-policies';

const { minimum, maximum } = SECOND_APPROVAL_THRESHOLD_LIMITS;

function halfDaysOf(text: string): number {
  return Math.round(Number(text.trim().replace(',', '.')) * 2);
}

/** When a leave request needs a second approver as well as the person's manager. */
export function LeaveRulesCard({ rules }: { readonly rules: LeaveRules }) {
  const toast = useToast();
  const fail = useFailureToast();
  const { updateRules } = useLeavePolicyMutations();
  const [days, setDays] = useState(String(rules.secondApprovalAboveHalfDays / 2));
  const [error, setError] = useState<string | null>(null);
  const halfDays = halfDaysOf(days);
  const valid =
    Number.isInteger(halfDays) && halfDays >= minimum && halfDays <= maximum && days.trim() !== '';
  const changed = valid && halfDays !== rules.secondApprovalAboveHalfDays;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) {
      setError(`Use half a day up to ${maximum / 2} days, in steps of half a day.`);
      return;
    }
    setError(null);
    updateRules.mutate(halfDays, {
      onSuccess: (saved) =>
        toast({
          tone: 'success',
          title: 'Leave rules saved',
          description: `A second approval is needed above ${formatHalfDays(saved.secondApprovalAboveHalfDays)}.`,
        }),
      onError: (failure) => {
        if (isApiError(failure))
          setError(failure.fieldErrors().secondApprovalAboveHalfDays ?? null);
        fail(failure, 'save the leave rules');
      },
    });
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-5 rounded-lg border border-hairline bg-raised p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
      noValidate
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-sunken text-ink-muted">
            <Stamp aria-hidden className="size-4" />
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="type-title-md text-ink">Second approval</h3>
            <p className="max-w-prose type-body-sm text-ink-muted">
              Every request goes to the person’s manager first. Longer requests, and any that touch
              critical work, then go to the owner or an administrator too.
            </p>
          </div>
        </div>
        <Field
          label="Needed for requests longer than"
          hint={valid ? `That is ${halfDays} half-days.` : 'In days; half days are allowed.'}
          error={error}
          className="max-w-xs sm:pl-12"
        >
          <Input
            inputMode="decimal"
            value={days}
            onChange={(event) => setDays(event.target.value)}
            trailing={<span className="pr-1">days</span>}
          />
        </Field>
      </div>
      <Button
        type="submit"
        variant="secondary"
        pending={updateRules.isPending}
        disabled={!changed}
        className="justify-self-start sm:ml-12 md:ml-0"
      >
        Save rule
      </Button>
    </form>
  );
}
