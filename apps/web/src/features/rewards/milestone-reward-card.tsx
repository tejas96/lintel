'use client';

import type { MilestoneRewardShare } from '@lintel/api-contracts';
import { Avatar, Badge, cn, listItemEnter, StatusPill } from '@lintel/design-system/web';
import { Flag } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { formatCalendarDate, formatRelativeInstant } from '@/lib/format/dates';
import { CriteriaResults } from './criteria-results';
import { formatAmount } from './reward-presentation';
import { MILESTONE_SHARE_STATUS, payableShare } from './reward-record-presentation';
import { RewardSeal } from './reward-seal';

interface MilestoneRewardCardProps {
  readonly share: MilestoneRewardShare;
  readonly today: string;
  /** Show whose reward it is (review queue). */
  readonly showSubject?: boolean;
  readonly index?: number;
  /** Decision controls or the challenge area, under the findings. */
  readonly children?: ReactNode;
}

function AmountLine({ share }: { readonly share: MilestoneRewardShare }) {
  const amount = payableShare(share);
  if (amount === null || share.status === 'withdrawn') return null;
  return (
    <div className="flex flex-col items-end gap-0.5 text-right">
      <p className="font-display text-[1.75rem] leading-8 text-ink tabular-nums">
        {formatAmount(amount, share.currency)}
      </p>
      {share.sharedBy > 1 && share.totalAmountMinor !== null && (
        <p className="type-body-sm text-ink-faint">
          Share of {formatAmount(share.totalAmountMinor, share.currency)}, split {share.sharedBy}{' '}
          ways
        </p>
      )}
    </div>
  );
}

/**
 * One person's milestone reward. Before completion it lists what earns it;
 * after, what the rules found and how a person decided. An approved reward
 * carries the embossed seal, like a periodic one.
 */
export function MilestoneRewardCard({
  share,
  today,
  showSubject = false,
  index = 0,
  children,
}: MilestoneRewardCardProps) {
  const look = MILESTONE_SHARE_STATUS[share.status];
  const approved = share.status === 'approved';
  const planned = share.status === 'planned';
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
          {showSubject && share.user && (
            <p className="flex items-center gap-2 type-body-sm text-ink-muted">
              <Avatar name={share.user.fullName} hue={share.user.avatarHue} size="xs" decorative />
              <span className="font-medium text-ink">{share.user.fullName}</span>
            </p>
          )}
          <p className="flex flex-wrap items-center gap-2">
            <Badge>
              <Flag aria-hidden className="size-3" /> Milestone
            </Badge>
            <span className="type-body-sm text-ink-muted">
              {share.project.reference} · {share.project.name}
            </span>
          </p>
          <h3 className="type-display-md text-ink">{share.milestone.name}</h3>
          <p className="type-body-sm text-ink-muted">
            {planned
              ? `Agreed date ${formatCalendarDate(share.agreedDueDate, today)}`
              : share.milestone.completedAt
                ? `Completed ${formatRelativeInstant(share.milestone.completedAt)}`
                : `Due ${formatCalendarDate(share.milestone.dueDate, today)}`}
            {share.sharedBy > 1 ? ` · shared by ${share.sharedBy} people` : ''}
          </p>
        </div>
        <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
          <StatusPill tone={look.tone} glyph={look.glyph} label={look.label} size="sm" />
          <AmountLine share={share} />
        </div>
      </header>
      {planned ? (
        <PlannedConditions share={share} />
      ) : (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {share.summary && !share.decidedBy && (
              <p className="type-body text-ink">{share.summary}</p>
            )}
            {share.criteria.length > 0 && <CriteriaResults criteria={share.criteria} />}
          </div>
          {approved && (
            <RewardSeal
              evaluationId={share.id}
              celebrate={!showSubject}
              className="self-center sm:mt-1"
            />
          )}
        </div>
      )}
      {share.adjustedAmountMinor !== null && share.shareAmountMinor !== null && (
        <p className="type-body-sm text-ink-muted">
          Adjusted from {formatAmount(share.shareAmountMinor, share.currency)}
          {share.adjustmentReason && share.adjustmentReason !== share.decisionNote
            ? `: ${share.adjustmentReason}`
            : '.'}
        </p>
      )}
      {share.decidedBy && (
        <p className="border-t border-hairline pt-4 type-body-sm text-ink-muted">
          {approved ? 'Approved' : 'Decided'} by {share.decidedBy.fullName}
          {share.decidedAt && `, ${formatRelativeInstant(share.decidedAt)}`}
          {share.decisionNote && <span className="text-ink">: “{share.decisionNote}”</span>}
        </p>
      )}
      {children}
    </motion.li>
  );
}

/** What earns the reward, in the order the rules check it. */
function PlannedConditions({ share }: { readonly share: MilestoneRewardShare }) {
  return (
    <div className="flex flex-col gap-3">
      {share.note && <p className="type-body text-ink">{share.note}</p>}
      <ol className="flex flex-col gap-2">
        {share.conditions.map((condition, position) => (
          <li key={condition} className="flex gap-3 type-body-sm text-ink-muted">
            <span
              aria-hidden
              className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-rule font-mono text-[0.6875rem] text-ink-faint"
            >
              {position + 1}
            </span>
            <span className="min-w-0">{condition}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
