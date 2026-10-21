import { type CalendarDate, daysBetween } from '@lintel/shared';
import { periodIndexOf } from './report-periods';
import type { ReportPlan, ReportSpan } from './report-plan';

/** A task or milestone with a deadline. Cancelled and archived work is never a fact. */
export interface DeliveryFact {
  readonly kind: 'task' | 'milestone';
  readonly projectId: string;
  /** Task owner; null for milestones and unassigned tasks. */
  readonly ownerUserId: string | null;
  /** The current (latest approved) due date. */
  readonly dueDate: CalendarDate;
  /** The completion day in the business timezone; null while still open. */
  readonly completedOn: CalendarDate | null;
}

export type DeliveryOutcome = 'on_time' | 'late' | 'open_overdue';

export interface PlacedOutcome {
  readonly outcome: DeliveryOutcome;
  /** Completion day for finished work, the due date for open overdue work. */
  readonly date: CalendarDate;
  /** Calendar days after the due date (0 when on time). */
  readonly daysLate: number;
}

/**
 * On time = completed on or before its due date. Late = completed after it.
 * Both count in the range when the completion day falls inside it. Open
 * overdue = still open, due inside the range and before today: work that is
 * already late but not delivered yet. Anything else does not count.
 */
export function placeDelivery(
  fact: DeliveryFact,
  range: ReportSpan,
  today: CalendarDate,
): PlacedOutcome | null {
  if (fact.completedOn !== null) {
    if (fact.completedOn < range.start || fact.completedOn > range.end) return null;
    const daysLate = Math.max(0, daysBetween(fact.dueDate, fact.completedOn));
    return { outcome: daysLate > 0 ? 'late' : 'on_time', date: fact.completedOn, daysLate };
  }
  if (fact.dueDate < range.start || fact.dueDate > range.end || fact.dueDate >= today) return null;
  return {
    outcome: 'open_overdue',
    date: fact.dueDate,
    daysLate: daysBetween(fact.dueDate, today),
  };
}

export interface DeliveryTally {
  readonly onTime: number;
  readonly late: number;
  readonly openOverdue: number;
  /** On time ÷ (on time + late), rounded to 0.001; null when nothing was completed. */
  readonly onTimeRate: number | null;
  /** Mean calendar days late over late completions, rounded to 0.1; null without any. */
  readonly averageDaysLate: number | null;
}

export const EMPTY_TALLY: DeliveryTally = {
  onTime: 0,
  late: 0,
  openOverdue: 0,
  onTimeRate: null,
  averageDaysLate: null,
};

export function tallyDelivery(outcomes: readonly PlacedOutcome[]): DeliveryTally {
  const onTime = outcomes.filter((item) => item.outcome === 'on_time').length;
  const late = outcomes.filter((item) => item.outcome === 'late');
  const completed = onTime + late.length;
  const daysLate = late.reduce((total, item) => total + item.daysLate, 0);
  return {
    onTime,
    late: late.length,
    openOverdue: outcomes.filter((item) => item.outcome === 'open_overdue').length,
    onTimeRate: completed === 0 ? null : Math.round((onTime / completed) * 1000) / 1000,
    averageDaysLate: late.length === 0 ? null : Math.round((daysLate / late.length) * 10) / 10,
  };
}

export interface DeliveryPair {
  readonly tasks: DeliveryTally;
  readonly milestones: DeliveryTally;
}

export interface DeliveryBreakdown {
  readonly totals: DeliveryPair;
  /** One entry per plan period, in order. */
  readonly byPeriod: readonly DeliveryPair[];
  readonly byProject: ReadonlyMap<string, DeliveryPair>;
  /** Tasks by owner; milestones have no single owner. */
  readonly byOwner: ReadonlyMap<string, DeliveryTally>;
}

interface Placed {
  readonly fact: DeliveryFact;
  readonly placed: PlacedOutcome;
}

function pair(items: readonly Placed[]): DeliveryPair {
  return {
    tasks: tallyDelivery(items.filter((item) => item.fact.kind === 'task').map((i) => i.placed)),
    milestones: tallyDelivery(
      items.filter((item) => item.fact.kind === 'milestone').map((i) => i.placed),
    ),
  };
}

function groupBy<K>(items: readonly Placed[], key: (item: Placed) => K | null): Map<K, Placed[]> {
  const groups = new Map<K, Placed[]>();
  for (const item of items) {
    const value = key(item);
    if (value === null) continue;
    groups.set(value, [...(groups.get(value) ?? []), item]);
  }
  return groups;
}

/** Every delivery number of the report, from the facts of the scoped projects. */
export function buildDeliveryBreakdown(
  facts: readonly DeliveryFact[],
  plan: Pick<ReportPlan, 'range' | 'today' | 'periods'>,
): DeliveryBreakdown {
  const placed = facts.flatMap((fact): Placed[] => {
    const outcome = placeDelivery(fact, plan.range, plan.today);
    return outcome ? [{ fact, placed: outcome }] : [];
  });
  const periods = groupBy(placed, (item) => periodIndexOf(plan.periods, item.placed.date));
  const projects = groupBy(placed, (item) => item.fact.projectId);
  const owners = groupBy(
    placed.filter((item) => item.fact.kind === 'task'),
    (item) => item.fact.ownerUserId,
  );
  return {
    totals: pair(placed),
    byPeriod: plan.periods.map((_, index) => pair(periods.get(index) ?? [])),
    byProject: new Map([...projects].map(([id, items]) => [id, pair(items)])),
    byOwner: new Map(
      [...owners].map(([id, items]) => [id, tallyDelivery(items.map((item) => item.placed))]),
    ),
  };
}
