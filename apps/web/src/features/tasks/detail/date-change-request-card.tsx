'use client';

import type { DateChangeRequest } from '@lintel/api-contracts';
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
import { formatCalendarDate, formatRelativeInstant } from '@/lib/format/dates';
import { useDateChangeMutations } from './use-date-changes';

const STATUS: Readonly<
  Record<DateChangeRequest['status'], { tone: PillTone; glyph: StatusGlyphName; label: string }>
> = {
  open: { tone: 'review', glyph: 'review', label: 'Waiting for a decision' },
  accepted: { tone: 'done', glyph: 'done', label: 'New date set' },
  declined: { tone: 'neutral', glyph: 'cancelled', label: 'Declined' },
  withdrawn: { tone: 'neutral', glyph: 'cancelled', label: 'Withdrawn' },
};

function DateMove({ from, to, today }: { from: string | null; to: string; today: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 font-mono text-[0.8125rem] text-ink">
      <span
        className={from ? 'text-ink-muted line-through decoration-ink-faint' : 'text-ink-faint'}
      >
        {from ? formatCalendarDate(from, today) : 'not set'}
      </span>
      <ArrowRight aria-hidden className="size-3.5 text-ink-faint" />
      <span className="sr-only">to</span>
      <span className="font-medium">{formatCalendarDate(to, today)}</span>
    </span>
  );
}

/** The project manager accepts the new dates or declines with a note. */
function DecisionPanel({ request }: { readonly request: DateChangeRequest }) {
  const { decide } = useDateChangeMutations(request.task.id);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const run = (decision: 'accepted' | 'declined') => {
    if (decision === 'declined' && note.trim().length < 3) {
      setError('Say why, so they know what to do next.');
      return;
    }
    setError(null);
    decide.mutate({ request, decision, note: note.trim() || null });
  };
  return (
    <div className="flex flex-col gap-3 border-t border-hairline pt-4">
      <Field label="Note" hint="Optional to accept, needed to decline." error={error}>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={2000}
        />
      </Field>
      <p className="type-body-sm text-ink-faint">
        Accepting moves only this task; the history keeps the old date. Later tasks keep theirs: use
        a scope change to move them too.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          pending={decide.isPending && decide.variables?.decision === 'accepted'}
          onClick={() => run('accepted')}
        >
          Accept the new date
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

/** One request: who asked, why, the dates it moves, and what was decided. */
export function DateChangeRequestCard({
  request,
  today,
}: {
  readonly request: DateChangeRequest;
  readonly today: string;
}) {
  const { withdraw } = useDateChangeMutations(request.task.id);
  const status = STATUS[request.status];
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
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 type-body-sm">
        <dt className="text-ink-muted">Due</dt>
        <dd>
          <DateMove from={request.previousDueDate} to={request.proposedDueDate} today={today} />
        </dd>
        {request.proposedStartDate && (
          <>
            <dt className="text-ink-muted">Start</dt>
            <dd>
              <DateMove
                from={request.previousStartDate}
                to={request.proposedStartDate}
                today={today}
              />
            </dd>
          </>
        )}
      </dl>
      <blockquote className="border-l-2 border-rule pl-3 type-body-sm whitespace-pre-wrap text-ink">
        {request.reason}
      </blockquote>
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
