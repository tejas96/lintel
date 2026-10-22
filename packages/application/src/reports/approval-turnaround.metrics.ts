export const APPROVAL_KINDS = [
  'deliverable_review',
  'leave_decision',
  'scope_change',
  'date_change',
  'reassignment',
] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

/**
 * One request for a decision. Deliverable reviews: a submitted version until
 * its review. Leave: a request until its final approval or rejection (urgent
 * absences are recorded, not requested, and cancelled requests were never
 * decided, so neither is a fact). Scope changes: a proposal until it is
 * approved or rejected (withdrawn ones are not facts). New-date and handover
 * (reassignment) requests: asked until accepted or declined (withdrawn ones
 * are not facts).
 */
export interface DecisionFact {
  readonly kind: ApprovalKind;
  readonly id: string;
  readonly requestedAt: Date;
  /** Null while it is still waiting. */
  readonly decidedAt: Date | null;
  readonly deciderUserId: string | null;
}

const HOUR_MS = 3_600_000;

/** Elapsed clock hours (not working hours), rounded to 0.1. */
export function elapsedHours(from: Date, to: Date): number {
  return Math.round(((to.getTime() - from.getTime()) / HOUR_MS) * 10) / 10;
}

/** The middle value; the mean of the two middle values for an even count; null when empty. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[middle - 1] ?? upper;
  return Math.round(((lower + upper) / 2) * 10) / 10;
}

export interface TurnaroundSummary {
  /** Decisions made inside the window. */
  readonly decided: number;
  readonly medianHours: number | null;
  readonly slowestHours: number | null;
  /** The decided fact that took longest (ties: the earlier request). */
  readonly slowest: DecisionFact | null;
  /** Requests still waiting now, whenever they were made. */
  readonly waiting: number;
  readonly oldestWaitingHours: number | null;
}

/** A half-open window of instants: [from, to). */
export interface InstantRange {
  readonly from: Date;
  readonly to: Date;
}

export function decidedWithin(fact: DecisionFact, window: InstantRange): boolean {
  return fact.decidedAt !== null && fact.decidedAt >= window.from && fact.decidedAt < window.to;
}

/**
 * Turnaround = decided − requested, in elapsed hours. Median and slowest are
 * over decisions made inside the window; waiting counts what is undecided now.
 */
export function summarizeTurnaround(
  facts: readonly DecisionFact[],
  window: InstantRange,
  now: Date,
): TurnaroundSummary {
  const decided = facts
    .filter((fact) => decidedWithin(fact, window))
    .map((fact) => ({ fact, hours: elapsedHours(fact.requestedAt, fact.decidedAt ?? now) }));
  const slowest = [...decided].sort(
    (left, right) =>
      right.hours - left.hours ||
      left.fact.requestedAt.getTime() - right.fact.requestedAt.getTime(),
  )[0];
  const waiting = facts.filter((fact) => fact.decidedAt === null);
  return {
    decided: decided.length,
    medianHours: median(decided.map((item) => item.hours)),
    slowestHours: slowest?.hours ?? null,
    slowest: slowest?.fact ?? null,
    waiting: waiting.length,
    oldestWaitingHours:
      waiting.length === 0
        ? null
        : Math.max(...waiting.map((fact) => elapsedHours(fact.requestedAt, now))),
  };
}

/** The decided facts inside the window, slowest first (for the "slowest decisions" list). */
export function slowestDecisions(
  facts: readonly DecisionFact[],
  window: InstantRange,
  limit: number,
): { fact: DecisionFact; hours: number }[] {
  return facts
    .filter((fact) => decidedWithin(fact, window))
    .map((fact) => ({
      fact,
      hours: elapsedHours(fact.requestedAt, fact.decidedAt ?? fact.requestedAt),
    }))
    .sort((left, right) => right.hours - left.hours)
    .slice(0, limit);
}
