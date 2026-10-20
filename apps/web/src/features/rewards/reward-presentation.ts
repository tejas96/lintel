import type { RewardEvaluation } from '@lintel/api-contracts';
import type { PillTone, StatusGlyphName } from '@lintel/design-system/web';
import { formatMonthLong } from '@/lib/format/dates';

export const EVALUATION_STATUS: Readonly<
  Record<
    RewardEvaluation['status'],
    { readonly tone: PillTone; readonly glyph: StatusGlyphName; readonly label: string }
  >
> = {
  ineligible: { tone: 'neutral', glyph: 'notStarted', label: 'Not eligible this period' },
  pending_review: { tone: 'review', glyph: 'review', label: 'Waiting for review' },
  approved: { tone: 'onTrack', glyph: 'done', label: 'Approved' },
  rejected: { tone: 'overdue', glyph: 'offTrack', label: 'Not approved' },
};

/** "October 2026", or "October to December 2026" for a quarter. */
export function formatPeriod(start: string, end: string): string {
  const year = end.slice(0, 4);
  const from = formatMonthLong(start);
  const to = formatMonthLong(end);
  return from === to ? `${from} ${year}` : `${from} to ${to} ${year}`;
}

/** "₹3,000" (whole rupees drop the paise). */
export function formatAmount(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

/** The amount the person receives: the adjusted one when a reviewer changed it. */
export function payableAmount(evaluation: RewardEvaluation): number | null {
  return evaluation.adjustedAmountMinor ?? evaluation.amountMinor;
}

/** Who or what the evaluation is about: a person, or a team. */
export function subjectName(evaluation: RewardEvaluation): string {
  return evaluation.user?.fullName ?? evaluation.team?.name ?? 'Unknown';
}
