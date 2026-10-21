'use client';

import type { ChallengeEntry } from '@lintel/api-contracts';
import { StatusPill } from '@lintel/design-system/web';
import { ArrowRight } from 'lucide-react';
import { formatRelativeInstant } from '@/lib/format/dates';
import { CHALLENGE_STATUS, outcomeWords } from './reward-record-presentation';

/**
 * Every challenge of one record, oldest first: what the person said, the
 * reviewer's answer and how the record changed. The full history stays
 * visible, so nothing about a decision is ever lost.
 */
export function ChallengeHistory({
  challenges,
  currency,
  viewerId,
}: {
  readonly challenges: readonly ChallengeEntry[];
  readonly currency: string;
  readonly viewerId: string;
}) {
  if (challenges.length === 0) return null;
  return (
    <section aria-label="Challenges" className="flex flex-col gap-3">
      <h4 className="type-label text-ink-muted">
        {challenges.length === 1 ? 'Challenge' : `Challenges (${challenges.length})`}
      </h4>
      <ol className="flex flex-col gap-3">
        {challenges.map((challenge) => {
          const look = CHALLENGE_STATUS[challenge.status];
          const mine = challenge.raisedBy?.id === viewerId;
          return (
            <li
              key={challenge.id}
              className="flex flex-col gap-3 rounded-md border border-hairline bg-surface p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="type-body-sm text-ink-muted">
                  {mine
                    ? 'You challenged this'
                    : `${challenge.raisedBy?.fullName ?? 'Someone'} challenged this`}{' '}
                  {formatRelativeInstant(challenge.createdAt)}
                </p>
                <StatusPill tone={look.tone} glyph={look.glyph} label={look.label} size="sm" />
              </div>
              <blockquote className="border-l-2 border-rule pl-3 type-body text-ink">
                {challenge.reason}
              </blockquote>
              {challenge.resolvedAt && (
                <div className="flex flex-col gap-2 border-t border-hairline pt-3">
                  <p className="type-body-sm text-ink-muted">
                    Answered by {challenge.resolvedBy?.fullName ?? 'a reviewer'}{' '}
                    {formatRelativeInstant(challenge.resolvedAt)}
                    {challenge.resolutionNote && (
                      <span className="text-ink">: “{challenge.resolutionNote}”</span>
                    )}
                  </p>
                  {challenge.after && challenge.status === 'corrected' && (
                    <p className="flex flex-wrap items-center gap-2 type-body-sm text-ink-muted">
                      <span>{outcomeWords(challenge.before, currency)}</span>
                      <ArrowRight aria-label="became" className="size-3.5 shrink-0" />
                      <span className="font-medium text-ink">
                        {outcomeWords(challenge.after, currency)}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
