'use client';

import type { LeaveType } from '@lintel/api-contracts';
import { Button, Field, Sheet, Textarea, useToast } from '@lintel/design-system/web';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PersonCombobox } from '@/features/people/person-combobox';
import { usePeopleOptions } from '@/features/people/use-people-options';
import { api, expectStatus } from '@/lib/api/api-client';
import { isApiError } from '@/lib/api/api-error';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { LeavePeriodFields, useLeavePeriodForm } from './leave-period-fields';
import { LeavePreviewPanel } from './leave-preview-panel';
import { useLeavePreview } from './use-leave';

interface RecordAbsenceSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly types: readonly LeaveType[];
  readonly today: string;
}

/**
 * A manager records someone's unplanned absence. Their affected work is
 * flagged for reassessment; nothing is reassigned automatically.
 */
export function RecordAbsenceSheet({ open, onOpenChange, types, today }: RecordAbsenceSheetProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  const people = usePeopleOptions();
  const form = useLeavePeriodForm(types);
  const [userId, setUserId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const preview = useLeavePreview(userId ? form.period : null, open, userId);
  const person = people.people.find((candidate) => candidate.id === userId);
  const firstName = person?.fullName.split(' ')[0];

  const record = useMutation({
    mutationFn: () => {
      if (!form.period || !userId) throw new Error('Choose the person and the days first.');
      return expectStatus(
        api.leave.recordUrgentAbsence({ body: { ...form.period, userId, reason: reason.trim() } }),
        201,
      );
    },
    onSuccess: (request) => {
      void queryClient.invalidateQueries({ queryKey: ['leave'] });
      toast({
        tone: 'success',
        title: 'Absence recorded',
        description: `${request.user.fullName}’s project managers have been asked to reassess their work. Nothing was reassigned.`,
      });
      form.reset();
      setUserId(null);
      setReason('');
      onOpenChange(false);
      router.push(`/leave/${request.id}`);
    },
    onError: (failure) => {
      if (isApiError(failure)) setErrors(failure.fieldErrors());
      fail(failure, 'record the absence');
    },
  });

  const submit = () => {
    const found: Record<string, string> = {};
    if (!userId) found.userId = 'Choose who is absent.';
    if (reason.trim().length < 3) found.reason = 'Say briefly what happened.';
    setErrors(found);
    if (Object.keys(found).length === 0) record.mutate();
  };

  return (
    <Sheet
      autoFocusField
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title="Record an absence"
      description="For someone who is unexpectedly away. Their work is flagged for reassessment, never reassigned on its own."
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!form.period}
            pending={record.isPending}
            onClick={submit}
          >
            Record absence
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6 p-5 sm:p-6">
        <Field label="Who is absent" error={errors.userId} required>
          <PersonCombobox value={userId} onValueChange={setUserId} placeholder="Search people" />
        </Field>
        <LeavePeriodFields form={form} today={today} />
        <Field
          label="What happened"
          hint="Visible to their approvers and project managers."
          error={errors.reason}
          required
        >
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            maxLength={2000}
          />
        </Field>
        {userId ? (
          <LeavePreviewPanel
            period={form.period}
            preview={preview}
            today={today}
            {...(firstName ? { subject: firstName } : {})}
          />
        ) : (
          <p className="rounded-lg border border-hairline bg-surface p-4 type-body-sm text-ink-faint">
            Choose the person and the days to see the work their absence affects.
          </p>
        )}
      </div>
    </Sheet>
  );
}
