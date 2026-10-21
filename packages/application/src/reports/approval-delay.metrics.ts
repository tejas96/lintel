import { type CalendarDate, zonedTimeToInstant } from '@lintel/shared';
import { elapsedHours, type InstantRange, median } from './approval-turnaround.metrics';

/**
 * client_signoff: a milestone that needs the client's approval, from the
 * moment its work was ready to the recorded sign-off. client_wait: a task
 * blocked on the client, from raised to resolved. internal_review: a
 * submitted deliverable version, from submission to its review.
 */
export const DELAY_KINDS = ['client_signoff', 'client_wait', 'internal_review'] as const;
export type DelayKind = (typeof DELAY_KINDS)[number];

/** A wait longer than this many elapsed hours is delayed (exactly 48 h is not). */
export const DELAYED_AFTER_HOURS = 48;
/** A client or project with this many delayed approvals in the range is a recurring delay. */
export const RECURRING_DELAY_COUNT = 3;

export interface DelayFact {
  readonly kind: DelayKind;
  readonly id: string;
  readonly projectId: string;
  /** When the wait began. */
  readonly readyAt: Date;
  /** When it ended; null while it is still waiting. */
  readonly resolvedAt: Date | null;
}

/** Elapsed clock hours from ready to resolved (or to now while waiting), to 0.1, never negative. */
export function waitHours(fact: Pick<DelayFact, 'readyAt' | 'resolvedAt'>, now: Date): number {
  return Math.max(0, elapsedHours(fact.readyAt, fact.resolvedAt ?? now));
}

export function isDelayed(hours: number): boolean {
  return hours > DELAYED_AFTER_HOURS;
}

export function isRecurringDelay(delayed: number): boolean {
  return delayed >= RECURRING_DELAY_COUNT;
}

/**
 * When a client sign-off became possible: the latest completion of the
 * milestone's done tasks; with no done task, 00:00 on its due date in the
 * studio timezone.
 */
export function signoffReadyAt(
  doneTaskCompletions: readonly Date[],
  dueDate: CalendarDate,
  timeZone: string,
): Date {
  if (doneTaskCompletions.length === 0) return zonedTimeToInstant(dueDate, '00:00', timeZone);
  return new Date(Math.max(...doneTaskCompletions.map((at) => at.getTime())));
}

export interface DelaySummary {
  /** Waits that ended inside the window. */
  readonly count: number;
  /** Of those, the ones longer than 48 hours. */
  readonly delayed: number;
  readonly medianHours: number | null;
  readonly slowestHours: number | null;
  /** Still waiting now, whenever the wait began. */
  readonly waitingNow: number;
  readonly oldestWaitingHours: number | null;
}

export const EMPTY_DELAY_SUMMARY: DelaySummary = {
  count: 0,
  delayed: 0,
  medianHours: null,
  slowestHours: null,
  waitingNow: 0,
  oldestWaitingHours: null,
};

export function endedWithin(fact: DelayFact, window: InstantRange): boolean {
  return fact.resolvedAt !== null && fact.resolvedAt >= window.from && fact.resolvedAt < window.to;
}

/**
 * Over waits that ended in the window: count, delayed (> 48 h), median and
 * slowest hours. Waiting now: facts not yet resolved, with the oldest's age.
 */
export function summarizeDelays(
  facts: readonly DelayFact[],
  window: InstantRange,
  now: Date,
): DelaySummary {
  const hours = facts.filter((fact) => endedWithin(fact, window)).map((f) => waitHours(f, now));
  const waiting = facts.filter((fact) => fact.resolvedAt === null).map((f) => waitHours(f, now));
  return {
    count: hours.length,
    delayed: hours.filter(isDelayed).length,
    medianHours: median(hours),
    slowestHours: hours.length === 0 ? null : Math.max(...hours),
    waitingNow: waiting.length,
    oldestWaitingHours: waiting.length === 0 ? null : Math.max(...waiting),
  };
}

/** Clients are grouped by name, trimmed and case-insensitive. */
export function clientKey(name: string): string {
  return name.trim().toLocaleLowerCase('en-IN');
}

export interface DelayGroup {
  readonly total: DelaySummary;
  readonly kinds: ({ readonly kind: DelayKind } & DelaySummary)[];
  /** Three or more delayed approvals in the range. */
  readonly recurring: boolean;
}

/** One client's or project's waits: all kinds together and each kind that has any. */
export function summarizeDelayGroup(
  facts: readonly DelayFact[],
  window: InstantRange,
  now: Date,
): DelayGroup {
  const total = summarizeDelays(facts, window, now);
  return {
    total,
    kinds: DELAY_KINDS.map((kind) => ({
      kind,
      ...summarizeDelays(
        facts.filter((fact) => fact.kind === kind),
        window,
        now,
      ),
    })).filter((row) => row.count > 0 || row.waitingNow > 0),
    recurring: isRecurringDelay(total.delayed),
  };
}

/** Most delayed first, then most waiting now, then the slowest. */
export function compareDelayGroups(left: DelayGroup, right: DelayGroup): number {
  return (
    right.total.delayed - left.total.delayed ||
    right.total.waitingNow - left.total.waitingNow ||
    (right.total.slowestHours ?? 0) - (left.total.slowestHours ?? 0)
  );
}

/** Waits that ended in the window, longest first (ties: the earlier start); at most `limit`. */
export function slowestWaits<T extends DelayFact>(
  facts: readonly T[],
  window: InstantRange,
  now: Date,
  limit: number,
): { fact: T; hours: number }[] {
  return facts
    .filter((fact) => endedWithin(fact, window))
    .map((fact) => ({ fact, hours: waitHours(fact, now) }))
    .sort(
      (left, right) =>
        right.hours - left.hours || left.fact.readyAt.getTime() - right.fact.readyAt.getTime(),
    )
    .slice(0, limit);
}
