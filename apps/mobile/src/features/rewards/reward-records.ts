import type {
  ChallengeEntry,
  MilestoneRewardShare,
  RewardEvaluation,
  UserSummary,
} from '@lintel/api-contracts';
import type { RewardRecordKind } from '@lintel/domain';
import type { RewardRecordStatus } from '@/theme/status-vocabulary';

export type CriterionFinding = RewardEvaluation['criteria'][number];

/**
 * A periodic evaluation or one person's milestone share, in the one shape the
 * cards need. Amounts stay null whenever the API hid them.
 */
export interface RewardRecord {
  readonly kind: RewardRecordKind;
  readonly id: string;
  /** What the record is under: the policy, or the project. */
  readonly context: string;
  /** "October 2026" for an evaluation; the milestone's name for a milestone reward. */
  readonly title: string;
  /** Project identity colour for milestone rewards; null for evaluations. */
  readonly projectColorIndex: number | null;
  readonly sharedBy: number;
  readonly status: Exclude<RewardRecordStatus, 'planned'>;
  readonly summary: string | null;
  readonly criteria: readonly CriterionFinding[];
  /** The policy amount or the person's share, before any adjustment. */
  readonly proposedAmountMinor: number | null;
  readonly adjustedAmountMinor: number | null;
  readonly adjustmentReason: string | null;
  readonly currency: string;
  readonly decidedBy: UserSummary | null;
  readonly decidedAt: string | null;
  readonly decisionNote: string | null;
  readonly challenges: readonly ChallengeEntry[];
  readonly challengeable: { readonly allowed: boolean; readonly reason: string | null };
  /** Newest first: when it was decided, else when it was checked. */
  readonly sortKey: string;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function monthName(date: string): string {
  return MONTHS[Number(date.slice(5, 7)) - 1] ?? date.slice(0, 7);
}

/** "October 2026", or "October to December 2026" for a quarter. */
export function formatRewardPeriod(start: string, end: string): string {
  const from = monthName(start);
  const to = monthName(end);
  const year = end.slice(0, 4);
  if (start.slice(0, 7) === end.slice(0, 7)) return `${from} ${year}`;
  return start.slice(0, 4) === year
    ? `${from} to ${to} ${year}`
    : `${from} ${start.slice(0, 4)} to ${to} ${year}`;
}

export function fromEvaluation(evaluation: RewardEvaluation): RewardRecord {
  return {
    kind: 'evaluation',
    id: evaluation.id,
    context: evaluation.team
      ? `${evaluation.policy.name} · ${evaluation.team.name}`
      : evaluation.policy.name,
    title: formatRewardPeriod(evaluation.periodStart, evaluation.periodEnd),
    projectColorIndex: null,
    sharedBy: 1,
    status: evaluation.status,
    summary: evaluation.summary,
    criteria: evaluation.criteria,
    proposedAmountMinor: evaluation.amountMinor,
    adjustedAmountMinor: evaluation.adjustedAmountMinor,
    adjustmentReason: evaluation.adjustmentReason,
    currency: evaluation.currency,
    decidedBy: evaluation.decidedBy,
    decidedAt: evaluation.decidedAt,
    decisionNote: evaluation.decisionNote,
    challenges: evaluation.challenges,
    challengeable: evaluation.challengeable,
    sortKey: evaluation.decidedAt ?? evaluation.createdAt,
  };
}

/** A milestone share once the milestone completed (or the reward was withdrawn). */
export function fromMilestoneShare(
  share: MilestoneRewardShare & { readonly status: RewardRecord['status'] },
): RewardRecord {
  return {
    kind: 'milestone',
    id: share.id,
    context: `${share.project.reference} · ${share.project.name}`,
    title: share.milestone.name,
    projectColorIndex: share.project.colorIndex,
    sharedBy: share.sharedBy,
    status: share.status,
    summary: share.summary,
    criteria: share.criteria,
    proposedAmountMinor: share.shareAmountMinor,
    adjustedAmountMinor: share.adjustedAmountMinor,
    adjustmentReason: share.adjustmentReason,
    currency: share.currency,
    decidedBy: share.decidedBy,
    decidedAt: share.decidedAt,
    decisionNote: share.decisionNote,
    challenges: share.challenges,
    challengeable: share.challengeable,
    sortKey: share.decidedAt ?? share.milestone.completedAt ?? share.agreedDueDate,
  };
}

/** The amount the person receives: the adjusted one when a reviewer changed it. */
export function payableAmount(record: RewardRecord): number | null {
  return record.adjustedAmountMinor ?? record.proposedAmountMinor;
}

export type PlannedShare = MilestoneRewardShare & { readonly status: 'planned' };

function isPlanned(share: MilestoneRewardShare): share is PlannedShare {
  return share.status === 'planned';
}

function isUnderWay(
  share: MilestoneRewardShare,
): share is MilestoneRewardShare & { readonly status: RewardRecord['status'] } {
  return share.status !== 'planned';
}

export interface RewardSections {
  /** Milestone rewards still to be earned, soonest agreed date first. */
  readonly planned: readonly PlannedShare[];
  /** Checked by the rules; a reviewer has not decided yet. Newest first. */
  readonly waiting: readonly RewardRecord[];
  /** Approved, not approved, not eligible or withdrawn. Newest first. */
  readonly decided: readonly RewardRecord[];
}

/** The record a challenge sheet is about, from the lists already loaded; null if gone. */
export function findRewardRecord(
  kind: string | undefined,
  id: string | undefined,
  evaluations: readonly RewardEvaluation[],
  shares: readonly MilestoneRewardShare[],
): RewardRecord | null {
  if (kind === 'evaluation') {
    const evaluation = evaluations.find((candidate) => candidate.id === id);
    return evaluation ? fromEvaluation(evaluation) : null;
  }
  if (kind === 'milestone') {
    const share = shares.find((candidate) => candidate.id === id);
    return share && isUnderWay(share) ? fromMilestoneShare(share) : null;
  }
  return null;
}

const newestFirst = (left: RewardRecord, right: RewardRecord) =>
  right.sortKey.localeCompare(left.sortKey);

/** Splits the person's records into what is ahead, what is waiting and what was decided. */
export function groupRewardRecords(
  evaluations: readonly RewardEvaluation[],
  shares: readonly MilestoneRewardShare[],
): RewardSections {
  const records = [
    ...evaluations.map(fromEvaluation),
    ...shares.filter(isUnderWay).map(fromMilestoneShare),
  ];
  return {
    planned: shares
      .filter(isPlanned)
      .sort((left, right) => left.agreedDueDate.localeCompare(right.agreedDueDate)),
    waiting: records.filter((record) => record.status === 'pending_review').sort(newestFirst),
    decided: records.filter((record) => record.status !== 'pending_review').sort(newestFirst),
  };
}
