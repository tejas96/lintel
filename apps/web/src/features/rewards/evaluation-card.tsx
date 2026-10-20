'use client';

import type { RewardEvaluation } from '@lintel/api-contracts';
import { Avatar, cn, listItemEnter, StatusPill } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { formatRelativeInstant } from '@/lib/format/dates';
import { CriteriaResults } from './criteria-results';
import {
  EVALUATION_STATUS,
  formatAmount,
  formatPeriod,
  payableAmount,
  subjectName,
} from './reward-presentation';
import { RewardSeal } from './reward-seal';

interface EvaluationCardProps {
  readonly evaluation: RewardEvaluation;
  /** Show whose evaluation it is (review queue). */
  readonly showSubject?: boolean;
  readonly index?: number;
  /** Decision controls, under the evidence. */
  readonly children?: ReactNode;
}

/**
 * One evaluation as a sheet of paper: the period, every criterion with its
 * evidence, the amount when the viewer may see it, and the decision. An
 * approved reward carries an embossed seal.
 */
export function EvaluationCard({
  evaluation,
  showSubject = false,
  index = 0,
  children,
}: EvaluationCardProps) {
  const status = EVALUATION_STATUS[evaluation.status];
  const amount = payableAmount(evaluation);
  const approved = evaluation.status === 'approved';
  return (
    <motion.li
      {...listItemEnter(index)}
      className={cn(
        'flex flex-col gap-5 rounded-lg border border-hairline bg-raised p-5 sm:p-6',
        approved && 'shadow-e1',
      )}
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          {showSubject && (
            <p className="flex items-center gap-2 type-body-sm text-ink-muted">
              {evaluation.user && (
                <Avatar
                  name={evaluation.user.fullName}
                  hue={evaluation.user.avatarHue}
                  size="xs"
                  decorative
                />
              )}
              <span className="font-medium text-ink">{subjectName(evaluation)}</span>
            </p>
          )}
          <h3 className="type-display-md text-ink">
            {formatPeriod(evaluation.periodStart, evaluation.periodEnd)}
          </h3>
          <p className="type-body-sm text-ink-muted">{evaluation.policy.name}</p>
        </div>
        <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
          <StatusPill tone={status.tone} glyph={status.glyph} label={status.label} size="sm" />
          {amount !== null && evaluation.status !== 'ineligible' && (
            <p className="font-display text-[1.75rem] leading-8 text-ink tabular-nums">
              {formatAmount(amount, evaluation.currency)}
            </p>
          )}
        </div>
      </header>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {!evaluation.decidedBy && <p className="type-body text-ink">{evaluation.summary}</p>}
          <CriteriaResults criteria={evaluation.criteria} />
        </div>
        {approved && (
          <RewardSeal
            evaluationId={evaluation.id}
            celebrate={!showSubject}
            className="self-center sm:mt-1"
          />
        )}
      </div>
      {evaluation.adjustedAmountMinor !== null && evaluation.amountMinor !== null && (
        <p className="type-body-sm text-ink-muted">
          Adjusted from {formatAmount(evaluation.amountMinor, evaluation.currency)}
          {evaluation.adjustmentReason && evaluation.adjustmentReason !== evaluation.decisionNote
            ? `: ${evaluation.adjustmentReason}`
            : '.'}
        </p>
      )}
      {evaluation.decidedBy && (
        <p className="border-t border-hairline pt-4 type-body-sm text-ink-muted">
          {approved ? 'Approved' : 'Decided'} by {evaluation.decidedBy.fullName}
          {evaluation.decidedAt && `, ${formatRelativeInstant(evaluation.decidedAt)}`}
          {evaluation.decisionNote && (
            <span className="text-ink">: “{evaluation.decisionNote}”</span>
          )}
        </p>
      )}
      {children}
    </motion.li>
  );
}
