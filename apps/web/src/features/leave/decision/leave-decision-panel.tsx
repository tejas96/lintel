'use client';

import type { LeaveRequestDetail } from '@lintel/api-contracts';
import { Button, Field, SegmentedControl, Textarea } from '@lintel/design-system/web';
import { Check, MessageCircleQuestion, X } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import type { LeaveDecision } from './use-leave-decision';

const CHOICES = [
  { value: 'approve', label: 'Approve', icon: <Check aria-hidden /> },
  { value: 'request_info', label: 'Ask', icon: <MessageCircleQuestion aria-hidden /> },
  { value: 'reject', label: 'Reject', icon: <X aria-hidden /> },
] as const;

const COPY: Readonly<
  Record<LeaveDecision, { note: string; hint: string; button: string; noteRequired: boolean }>
> = {
  approve: {
    note: 'Note for them',
    hint: 'Optional. They see it with the approval.',
    button: 'Approve leave',
    noteRequired: false,
  },
  request_info: {
    note: 'Your question',
    hint: 'They answer on this page; the request waits until they do.',
    button: 'Send the question',
    noteRequired: true,
  },
  reject: {
    note: 'Why not',
    hint: 'Say why, so they can plan around it.',
    button: 'Reject leave',
    noteRequired: false,
  },
};

interface LeaveDecisionPanelProps {
  readonly request: LeaveRequestDetail;
  readonly pending: boolean;
  /** True while a refresh prompt is showing; deciding waits for the latest version. */
  readonly blocked: boolean;
  readonly onDecide: (input: { decision: LeaveDecision; note: string | null }) => void;
}

/** The approver's choice: approve, ask for more information, or reject — with a note. */
export function LeaveDecisionPanel({
  request,
  pending,
  blocked,
  onDecide,
}: LeaveDecisionPanelProps) {
  const headingId = useId();
  const [decision, setDecision] = useState<LeaveDecision>('approve');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[decision];
  const criticalCount = request.impact.conflicts.filter(
    (conflict) => conflict.severity === 'critical',
  ).length;
  const unanswered = request.handovers.filter((handover) => handover.status === 'proposed').length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = note.trim();
    if (copy.noteRequired && trimmed.length < 3) {
      setError('Write the question you want answered.');
      return;
    }
    setError(null);
    onDecide({ decision, note: trimmed || null });
  };

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-lg border border-hairline bg-raised p-5 shadow-e2"
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="type-title-md text-ink">
          Your decision
        </h2>
        <p className="type-body-sm text-ink-muted">
          {criticalCount > 0
            ? `${criticalCount} critical ${criticalCount === 1 ? 'task is' : 'tasks are'} affected. Check the handovers before approving.`
            : 'Nothing critical is affected by these days.'}
          {unanswered > 0 &&
            ` ${unanswered} ${unanswered === 1 ? 'handover is' : 'handovers are'} not answered yet.`}
        </p>
        {request.status === 'info_requested' && (
          <p className="type-body-sm text-ink-muted">
            {request.user.fullName.split(' ')[0]} hasn’t answered the question yet. You can still
            decide without the answer.
          </p>
        )}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <SegmentedControl
          label="Decision"
          value={decision}
          onValueChange={(next) => {
            setDecision(next);
            setError(null);
          }}
          options={CHOICES}
          className="grid w-full grid-cols-3"
        />
        <Field label={copy.note} hint={copy.hint} error={error} required={copy.noteRequired}>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={1000}
          />
        </Field>
        <Button
          type="submit"
          variant={decision === 'reject' ? 'danger' : 'primary'}
          pending={pending}
          disabled={blocked}
          className="w-full"
        >
          {copy.button}
        </Button>
      </form>
    </section>
  );
}
