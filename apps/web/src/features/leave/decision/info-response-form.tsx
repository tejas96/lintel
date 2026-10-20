'use client';

import type { LeaveRequestDetail } from '@lintel/api-contracts';
import { Button, Field, Textarea } from '@lintel/design-system/web';
import { type FormEvent, useId, useState } from 'react';
import { isApiError } from '@/lib/api/api-error';
import {
  type HandoverDrafts,
  HandoverProposals,
  handoverErrorsFrom,
  handoversFrom,
} from '../handover-proposals';
import type { useLeaveDecisionMutations } from './use-leave-decision';

type RespondMutation = ReturnType<typeof useLeaveDecisionMutations>['respond'];

function draftsFrom(request: LeaveRequestDetail): HandoverDrafts {
  const drafts: Record<string, { toUserId: string | null; note: string }> = {};
  for (const handover of request.handovers) {
    if (handover.status === 'applied') continue;
    drafts[handover.task.id] = { toUserId: handover.to?.id ?? null, note: handover.note ?? '' };
  }
  return drafts;
}

interface InfoResponseFormProps {
  readonly request: LeaveRequestDetail;
  readonly mutation: RespondMutation;
  readonly blocked: boolean;
}

/** The requester answers the approver's question and can revise who covers their work. */
export function InfoResponseForm({ request, mutation, blocked }: InfoResponseFormProps) {
  const headingId = useId();
  const [reason, setReason] = useState(request.reason ?? '');
  const [drafts, setDrafts] = useState<HandoverDrafts>(() => draftsFrom(request));
  const [error, setError] = useState<string | null>(null);
  const [handoverErrors, setHandoverErrors] = useState<Record<string, string>>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < 3) {
      setError('Answer the question in a sentence or two.');
      return;
    }
    setError(null);
    const handovers = handoversFrom(drafts);
    mutation.mutate(
      { reason: reason.trim(), handovers, version: request.version },
      {
        onError: (failure) => {
          if (isApiError(failure)) setHandoverErrors(handoverErrorsFrom(failure, handovers));
        },
      },
    );
  };

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-lg border border-hairline bg-raised p-5 shadow-e2"
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="type-title-md text-ink">
          Answer your approver
        </h2>
        <p className="type-body-sm text-ink-muted">
          Your request waits until you reply. Your answer replaces the reason you gave.
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field label="Your answer" error={error} required>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            maxLength={2000}
          />
        </Field>
        <HandoverProposals
          conflicts={request.impact.conflicts}
          drafts={drafts}
          onChange={setDrafts}
          requesterId={request.user.id}
          errors={handoverErrors}
        />
        <Button
          type="submit"
          variant="primary"
          pending={mutation.isPending}
          disabled={blocked}
          className="self-start"
        >
          Send reply
        </Button>
      </form>
    </section>
  );
}
