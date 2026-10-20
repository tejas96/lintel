'use client';

import type { LeaveType } from '@lintel/api-contracts';
import { Button, Field, Sheet, Textarea, useToast } from '@lintel/design-system/web';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { isApiError } from '@/lib/api/api-error';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import type { HandoverProposal } from './decision/use-leave-decision';
import {
  type HandoverDrafts,
  HandoverProposals,
  handoverErrorsFrom,
  handoversFrom,
} from './handover-proposals';
import { LeavePeriodFields, useLeavePeriodForm } from './leave-period-fields';
import { LeavePreviewPanel } from './leave-preview-panel';
import { useLeavePreview } from './use-leave';

interface RequestLeaveSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly types: readonly LeaveType[];
  readonly today: string;
}

/** Pick the days; the impact updates as you choose, and you can propose who covers your work. */
export function RequestLeaveSheet({ open, onOpenChange, types, today }: RequestLeaveSheetProps) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  const form = useLeavePeriodForm(types);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<HandoverDrafts>({});
  const [handoverErrors, setHandoverErrors] = useState<Record<string, string>>({});
  const preview = useLeavePreview(form.period, open);
  const submit = useMutation({
    mutationFn: (handovers: HandoverProposal[]) => {
      if (!form.period) throw new Error('Choose the days first.');
      return expectStatus(
        api.leave.requestLeave({
          body: { ...form.period, reason: reason.trim() || null, handovers },
        }),
        201,
      );
    },
    onSuccess: (request) => {
      void queryClient.invalidateQueries({ queryKey: ['leave'] });
      toast({
        tone: 'success',
        title: 'Leave requested',
        description: `${request.durationLabel}. Your approver has been told.`,
      });
      form.reset();
      setReason('');
      setDrafts({});
      setHandoverErrors({});
      onOpenChange(false);
    },
    onError: (failure, handovers) => {
      if (isApiError(failure)) setHandoverErrors(handoverErrorsFrom(failure, handovers));
      fail(failure, 'send the request');
    },
  });
  const send = () => {
    if (form.type?.requiresReason && reason.trim().length < 3) {
      setError(`${form.type.name} needs a short reason.`);
      return;
    }
    setError(null);
    // Only tasks still affected by the chosen days can be handed over.
    const affected = new Set(preview.data?.conflicts.map((conflict) => conflict.taskId));
    submit.mutate(handoversFrom(drafts).filter((handover) => affected.has(handover.taskId)));
  };
  const blocked = (preview.data?.blockingProblems.length ?? 0) > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title="Request leave"
      description="Choose the days. You’ll see what it affects before you send it."
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!form.period || blocked || preview.isFetching}
            pending={submit.isPending}
            onClick={send}
          >
            Send request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6 p-5 sm:p-6">
        <LeavePeriodFields form={form} today={today} earliest={today} />
        <Field
          label="Reason"
          required={form.type?.requiresReason ?? false}
          hint={form.type?.requiresReason ? undefined : 'Optional.'}
          error={error}
        >
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>
        <LeavePreviewPanel period={form.period} preview={preview} today={today} />
        {form.period && preview.data && (
          <HandoverProposals
            conflicts={preview.data.conflicts}
            drafts={drafts}
            onChange={setDrafts}
            requesterId={user.id}
            errors={handoverErrors}
          />
        )}
      </div>
    </Sheet>
  );
}
