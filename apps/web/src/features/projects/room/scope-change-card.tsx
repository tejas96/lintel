'use client';

import type { ScopeChange } from '@lintel/api-contracts';
import {
  Avatar,
  Button,
  Field,
  type PillTone,
  type StatusGlyphName,
  StatusPill,
  Textarea,
} from '@lintel/design-system/web';
import { useState } from 'react';
import { formatRelativeInstant } from '@/lib/format/dates';
import { ScopeImpacts } from './scope-impacts';
import { useScopeChangeMutations } from './use-scope-changes';

const STATUS: Readonly<
  Record<ScopeChange['status'], { tone: PillTone; glyph: StatusGlyphName; label: string }>
> = {
  proposed: { tone: 'review', glyph: 'review', label: 'Waiting for a decision' },
  approved: { tone: 'onTrack', glyph: 'done', label: 'Approved' },
  rejected: { tone: 'overdue', glyph: 'offTrack', label: 'Rejected' },
  withdrawn: { tone: 'neutral', glyph: 'cancelled', label: 'Withdrawn' },
};

/** A proposed change to the plan, its impact, and (for approvers) the decision. */
export function ScopeChangeCard({
  change,
  today,
  canDecide,
}: {
  readonly change: ScopeChange;
  readonly today: string;
  readonly canDecide: boolean;
}) {
  const { decide } = useScopeChangeMutations(change.projectId);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const status = STATUS[change.status];
  const run = (decision: 'approved' | 'rejected') => {
    if (note.trim().length < 3) {
      setError('Add a short note explaining the decision.');
      return;
    }
    setError(null);
    decide.mutate({ id: change.id, decision, note: note.trim(), version: change.version });
  };
  return (
    <article className="flex flex-col gap-4 rounded-lg border border-hairline bg-raised p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="type-title-md text-ink">{change.title}</h3>
          <p className="flex items-center gap-2 type-body-sm text-ink-muted">
            <Avatar
              name={change.requestedBy.fullName}
              hue={change.requestedBy.avatarHue}
              size="xs"
              decorative
            />
            {change.requestedBy.fullName}, {formatRelativeInstant(change.createdAt)}
          </p>
        </div>
        <StatusPill tone={status.tone} glyph={status.glyph} label={status.label} size="sm" />
      </header>
      <p className="max-w-prose whitespace-pre-wrap type-body text-ink">{change.description}</p>
      <ScopeImpacts
        impacts={change.impacts}
        projectEndImpactDays={change.projectEndImpactDays}
        today={today}
      />
      {change.decidedBy && (
        <p className="type-body-sm text-ink-muted">
          {status.label} by {change.decidedBy.fullName}
          {change.decidedAt && `, ${formatRelativeInstant(change.decidedAt)}`}
          {change.decisionNote && <span className="text-ink">: “{change.decisionNote}”</span>}
        </p>
      )}
      {canDecide && change.status === 'proposed' && (
        <div className="flex flex-col gap-3 border-t border-hairline pt-4">
          <Field
            label="Decision note"
            hint="Approving applies the new dates and keeps the old ones in history."
            error={error}
            required
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
              pending={decide.isPending && decide.variables?.decision === 'approved'}
              onClick={() => run('approved')}
            >
              Approve and apply dates
            </Button>
            <Button
              variant="danger"
              size="sm"
              pending={decide.isPending && decide.variables?.decision === 'rejected'}
              onClick={() => run('rejected')}
            >
              Reject
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
