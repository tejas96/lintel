'use client';

import type { ReassignmentRequest } from '@lintel/api-contracts';
import {
  Avatar,
  Button,
  Field,
  type PillTone,
  type StatusGlyphName,
  StatusPill,
  Textarea,
} from '@lintel/design-system/web';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { AwayWarning, useAwayByPerson } from '@/features/leave/people-away';
import { PersonCombobox } from '@/features/people/person-combobox';
import { formatRelativeInstant } from '@/lib/format/dates';
import { useReassignmentMutations } from './use-reassignments';

export const REQUEST_STATUS: Readonly<
  Record<ReassignmentRequest['status'], { tone: PillTone; glyph: StatusGlyphName; label: string }>
> = {
  open: { tone: 'review', glyph: 'review', label: 'Waiting for a decision' },
  accepted: { tone: 'done', glyph: 'done', label: 'Reassigned' },
  declined: { tone: 'neutral', glyph: 'cancelled', label: 'Declined' },
  withdrawn: { tone: 'neutral', glyph: 'cancelled', label: 'Withdrawn' },
};

/** The project manager's choice: reassign (to the suggested person by default) or decline with a note. */
function DecisionPanel({ request }: { readonly request: ReassignmentRequest }) {
  const { decide } = useReassignmentMutations(request.task.id);
  const [owner, setOwner] = useState<string | null>(request.suggested?.id ?? null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<{ field: 'owner' | 'note'; message: string } | null>(null);
  const away = useAwayByPerson(request.task.id, true);
  const run = (decision: 'accepted' | 'declined') => {
    if (decision === 'accepted' && !owner) {
      setError({ field: 'owner', message: 'Choose who should own the task now.' });
      return;
    }
    if (decision === 'declined' && note.trim().length < 3) {
      setError({ field: 'note', message: 'Say why, so they know what to do next.' });
      return;
    }
    setError(null);
    decide.mutate({
      request,
      decision,
      newOwnerUserId: decision === 'accepted' ? owner : null,
      note: note.trim() || null,
    });
  };
  const excluded = [request.ownerAtRequest?.id].filter((id): id is string => Boolean(id));
  return (
    <div className="flex flex-col gap-3 border-t border-hairline pt-4">
      <Field
        label="New owner"
        error={error?.field === 'owner' ? error.message : null}
        hint="They are told straight away; the current owner hears too."
      >
        <PersonCombobox
          value={owner}
          onValueChange={setOwner}
          excludeIds={excluded}
          away={away.labels}
        />
      </Field>
      <AwayWarning userId={owner} away={away} />
      <Field
        label="Note"
        hint="Optional to reassign, needed to decline."
        error={error?.field === 'note' ? error.message : null}
      >
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={2000}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          pending={decide.isPending && decide.variables?.decision === 'accepted'}
          onClick={() => run('accepted')}
        >
          Reassign the task
        </Button>
        <Button
          variant="danger"
          size="sm"
          pending={decide.isPending && decide.variables?.decision === 'declined'}
          onClick={() => run('declined')}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}

/** One request: who asked, why, whom they suggested, and what was decided. */
export function ReassignmentRequestCard({ request }: { readonly request: ReassignmentRequest }) {
  const { withdraw } = useReassignmentMutations(request.task.id);
  const status = REQUEST_STATUS[request.status];
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-hairline bg-raised p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 type-body-sm text-ink-muted">
          <Avatar
            name={request.requestedBy.fullName}
            hue={request.requestedBy.avatarHue}
            size="xs"
            decorative
          />
          <span className="min-w-0 truncate">
            {request.requestedBy.fullName}, {formatRelativeInstant(request.createdAt)}
          </span>
        </p>
        <StatusPill tone={status.tone} glyph={status.glyph} label={status.label} size="sm" />
      </header>
      <blockquote className="border-l-2 border-rule pl-3 type-body-sm whitespace-pre-wrap text-ink">
        {request.reason}
      </blockquote>
      {request.suggested && request.status === 'open' && (
        <p className="type-body-sm text-ink-muted">
          Suggests <span className="font-medium text-ink">{request.suggested.fullName}</span>
        </p>
      )}
      {request.status === 'accepted' && (
        <p className="flex flex-wrap items-center gap-1.5 type-body-sm text-ink-muted">
          {request.ownerAtRequest?.fullName ?? 'Unassigned'}
          <ArrowRight aria-hidden className="size-3.5" />
          <span className="sr-only">to</span>
          <span className="font-medium text-ink">{request.newOwner?.fullName}</span>
          {request.decidedBy && <span>· by {request.decidedBy.fullName}</span>}
        </p>
      )}
      {request.decisionNote && (
        <p className="type-body-sm text-ink-muted">
          {request.decidedBy?.fullName ?? 'Decision'}:{' '}
          <span className="text-ink">“{request.decisionNote}”</span>
        </p>
      )}
      {request.viewerCanDecide && <DecisionPanel request={request} />}
      {request.viewerCanWithdraw && (
        <Button
          variant="quiet"
          size="sm"
          className="self-start"
          pending={withdraw.isPending}
          onClick={() => withdraw.mutate(request)}
        >
          Withdraw my request
        </Button>
      )}
    </article>
  );
}
