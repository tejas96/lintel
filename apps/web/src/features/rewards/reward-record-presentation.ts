import type { ChallengeEntry, MilestoneRewardShare } from '@lintel/api-contracts';
import type { PillTone, StatusGlyphName } from '@lintel/design-system/web';
import { formatAmount } from './reward-presentation';

interface StatusLook {
  readonly tone: PillTone;
  readonly glyph: StatusGlyphName;
  readonly label: string;
}

export const MILESTONE_SHARE_STATUS: Readonly<Record<MilestoneRewardShare['status'], StatusLook>> =
  {
    planned: { tone: 'neutral', glyph: 'notStarted', label: 'Planned' },
    pending_review: { tone: 'review', glyph: 'review', label: 'Waiting for review' },
    approved: { tone: 'onTrack', glyph: 'done', label: 'Approved' },
    rejected: { tone: 'overdue', glyph: 'offTrack', label: 'Not approved' },
    withdrawn: { tone: 'neutral', glyph: 'cancelled', label: 'Withdrawn' },
  };

export const CHALLENGE_STATUS: Readonly<Record<ChallengeEntry['status'], StatusLook>> = {
  open: { tone: 'review', glyph: 'review', label: 'Waiting for a reviewer' },
  upheld: { tone: 'neutral', glyph: 'done', label: 'Record upheld' },
  corrected: { tone: 'onTrack', glyph: 'done', label: 'Record corrected' },
};

const OUTCOME_WORDS: Readonly<Record<string, string>> = {
  planned: 'Planned',
  pending_review: 'Waiting for review',
  approved: 'Approved',
  rejected: 'Not approved',
  ineligible: 'Not eligible',
  withdrawn: 'Withdrawn',
};

/** "Approved · ₹2,500", "Not eligible" — a record's outcome at one moment, in words. */
export function outcomeWords(snapshot: ChallengeEntry['before'], currency: string): string {
  const word = OUTCOME_WORDS[snapshot.status] ?? snapshot.status;
  return snapshot.grantedAmountMinor === null
    ? word
    : `${word} · ${formatAmount(snapshot.grantedAmountMinor, currency)}`;
}

/** The amount the person receives from a milestone share: adjusted when a reviewer changed it. */
export function payableShare(share: MilestoneRewardShare): number | null {
  return share.adjustedAmountMinor ?? share.shareAmountMinor;
}

/** "Concept approved · ARN-2026-001". */
export function shareTitle(share: MilestoneRewardShare): string {
  return `${share.milestone.name} · ${share.project.reference}`;
}

/** The date a record is sorted by in "Decided": when it was decided, else when it was created. */
export function decidedOn(record: { decidedAt: string | null }, fallback: string): string {
  return (record.decidedAt ?? fallback).slice(0, 10);
}
