'use client';

import type { RewardChallenge } from '@lintel/api-contracts';
import { Avatar, Badge, listItemEnter, StatusPill } from '@lintel/design-system/web';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { formatRelativeInstant } from '@/lib/format/dates';
import { CriteriaResults } from './criteria-results';
import { formatAmount } from './reward-presentation';
import { CHALLENGE_STATUS, outcomeWords } from './reward-record-presentation';

/**
 * A challenge as the reviewer sees it: who disputes which record and why,
 * the record's findings as they stand, and the answer once there is one.
 */
export function ChallengeReviewCard({
  challenge,
  index,
  children,
}: {
  readonly challenge: RewardChallenge;
  readonly index: number;
  readonly children?: ReactNode;
}) {
  const look = CHALLENGE_STATUS[challenge.status];
  const { record } = challenge;
  return (
    <motion.li
      {...listItemEnter(index)}
      className="flex flex-col gap-5 rounded-lg border border-hairline bg-raised p-5 sm:p-6"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="flex items-center gap-2 type-body-sm text-ink-muted">
            {challenge.raisedBy && (
              <Avatar
                name={challenge.raisedBy.fullName}
                hue={challenge.raisedBy.avatarHue}
                size="xs"
                decorative
              />
            )}
            <span>
              <span className="font-medium text-ink">
                {challenge.raisedBy?.fullName ?? 'Someone'}
              </span>{' '}
              challenged a record {formatRelativeInstant(challenge.createdAt)}
            </span>
          </p>
          <h3 className="type-title-lg text-ink">{record.title}</h3>
          <p className="flex flex-wrap items-center gap-2">
            <Badge>{record.kind === 'milestone' ? 'Milestone reward' : 'Periodic reward'}</Badge>
            <span className="type-body-sm text-ink-muted">For {record.subjectName}</span>
          </p>
        </div>
        <StatusPill tone={look.tone} glyph={look.glyph} label={look.label} size="sm" />
      </header>
      <blockquote className="border-l-2 border-rule pl-4 type-body text-ink">
        {challenge.reason}
      </blockquote>
      <section aria-label="The record" className="flex flex-col gap-3 rounded-md bg-sunken/60 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="type-body-sm text-ink-muted">
            When challenged:{' '}
            <span className="font-medium text-ink">
              {outcomeWords(challenge.before, record.currency)}
            </span>
            {challenge.before.decisionNote && <> — “{challenge.before.decisionNote}”</>}
          </p>
          {record.proposedAmountMinor !== null && (
            <p className="type-body-sm text-ink-faint">
              Proposed {formatAmount(record.proposedAmountMinor, record.currency)}
            </p>
          )}
        </div>
        {record.summary && <p className="type-body-sm text-ink">{record.summary}</p>}
        {record.criteria.length > 0 && <CriteriaResults criteria={record.criteria} />}
      </section>
      {challenge.resolvedAt && (
        <div className="flex flex-col gap-2 border-t border-hairline pt-4">
          <p className="type-body-sm text-ink-muted">
            Answered by {challenge.resolvedBy?.fullName ?? 'a reviewer'}{' '}
            {formatRelativeInstant(challenge.resolvedAt)}
            {challenge.resolutionNote && (
              <span className="text-ink">: “{challenge.resolutionNote}”</span>
            )}
          </p>
          {challenge.after && (
            <p className="flex flex-wrap items-center gap-2 type-body-sm text-ink-muted">
              <span>{outcomeWords(challenge.before, record.currency)}</span>
              <ArrowRight aria-label="became" className="size-3.5 shrink-0" />
              <span className="font-medium text-ink">
                {outcomeWords(challenge.after, record.currency)}
              </span>
            </p>
          )}
        </div>
      )}
      {children}
    </motion.li>
  );
}
