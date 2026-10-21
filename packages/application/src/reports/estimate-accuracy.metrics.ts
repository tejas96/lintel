import type { CalendarDate } from '@lintel/shared';
import { median } from './approval-turnaround.metrics';
import { periodIndexOf, type ReportPeriod } from './report-periods';

/** A done task completed in the range (not archived), with what it was estimated and logged at. */
export interface EstimateFact {
  readonly taskId: string;
  readonly projectId: string;
  readonly ownerUserId: string | null;
  /** The task type: its template key within its project's template; null when added by hand. */
  readonly taskTypeKey: string | null;
  /** The project's workflow template; null when the project has none. */
  readonly templateId: string | null;
  /** Completion day in the studio timezone. */
  readonly completedOn: CalendarDate;
  /** Null or 0 = no estimate. */
  readonly estimateMinutes: number | null;
  /** Ended work sessions of everyone on the task, whole minutes. */
  readonly loggedMinutes: number;
}

/** Logged within 80 %–120 % of the estimate (both ends included) is "within estimate". */
export const WITHIN_ESTIMATE_LOW = 0.8;
export const WITHIN_ESTIMATE_HIGH = 1.2;

export type EstimateOutcome = 'within' | 'over' | 'under' | 'not_measured' | 'no_estimate';

/**
 * Measured = an estimate above zero and logged time above zero. Within when
 * logged ÷ estimated is 80 %–120 % inclusive, over above 120 %, under below
 * 80 %. Compared in integers (5 × logged against 4 or 6 × estimated) so the
 * boundaries are exact.
 */
export function estimateOutcome(
  fact: Pick<EstimateFact, 'estimateMinutes' | 'loggedMinutes'>,
): EstimateOutcome {
  const estimate = fact.estimateMinutes ?? 0;
  if (estimate <= 0) return 'no_estimate';
  if (fact.loggedMinutes <= 0) return 'not_measured';
  const scaled = fact.loggedMinutes * 5;
  if (scaled > estimate * 6) return 'over';
  if (scaled < estimate * 4) return 'under';
  return 'within';
}

export interface EstimateTally {
  /** Tasks with an estimate and logged time. Only these enter the ratios. */
  readonly measured: number;
  /** Sums over measured tasks. */
  readonly estimatedMinutes: number;
  readonly loggedMinutes: number;
  /** Logged ÷ estimated over measured tasks, to 0.001; null when nothing was measured. */
  readonly effortRatio: number | null;
  readonly within: number;
  readonly over: number;
  readonly under: number;
  /** Within ÷ measured, to 0.001; null when nothing was measured. */
  readonly withinRate: number | null;
  /** The median of each measured task's logged ÷ estimated, to 0.001. */
  readonly medianRatio: number | null;
  /** Estimated but no time logged: shown apart, never in the ratios. */
  readonly notMeasured: number;
  readonly withoutEstimate: number;
}

export const EMPTY_ESTIMATE_TALLY: EstimateTally = {
  measured: 0,
  estimatedMinutes: 0,
  loggedMinutes: 0,
  effortRatio: null,
  within: 0,
  over: 0,
  under: 0,
  withinRate: null,
  medianRatio: null,
  notMeasured: 0,
  withoutEstimate: 0,
};

const toThousandths = (value: number) => Math.round(value * 1000) / 1000;

export function tallyEstimates(facts: readonly EstimateFact[]): EstimateTally {
  const outcomes = facts.map((fact) => ({ fact, outcome: estimateOutcome(fact) }));
  const count = (outcome: EstimateOutcome) =>
    outcomes.filter((item) => item.outcome === outcome).length;
  const measured = outcomes
    .filter(
      (item) => item.outcome === 'within' || item.outcome === 'over' || item.outcome === 'under',
    )
    .map((item) => item.fact);
  const estimated = measured.reduce((total, fact) => total + (fact.estimateMinutes ?? 0), 0);
  const logged = measured.reduce((total, fact) => total + fact.loggedMinutes, 0);
  // Per-mille ratios, so the shared median's 0.1 rounding keeps 0.0001 of precision.
  const middle = median(
    measured.map((fact) => (fact.loggedMinutes / (fact.estimateMinutes ?? 1)) * 1000),
  );
  const within = count('within');
  return {
    measured: measured.length,
    estimatedMinutes: estimated,
    loggedMinutes: logged,
    effortRatio: measured.length === 0 ? null : toThousandths(logged / estimated),
    within,
    over: count('over'),
    under: count('under'),
    withinRate: measured.length === 0 ? null : toThousandths(within / measured.length),
    medianRatio: middle === null ? null : toThousandths(middle / 1000),
    notMeasured: count('not_measured'),
    withoutEstimate: count('no_estimate'),
  };
}

export interface EstimateBreakdown {
  readonly totals: EstimateTally;
  /** One entry per plan period, in order, by completion day. */
  readonly byPeriod: readonly EstimateTally[];
  /** Tasks by owner; unowned tasks count only in the totals. */
  readonly byOwner: ReadonlyMap<string, EstimateTally>;
  /** By task type; the null key holds the tasks added by hand. */
  readonly byTaskType: ReadonlyMap<string | null, EstimateTally>;
  /** By the project's template; the null key holds projects without one. */
  readonly byTemplate: ReadonlyMap<string | null, EstimateTally>;
}

function tallyBy<K>(
  facts: readonly EstimateFact[],
  key: (fact: EstimateFact) => K | undefined,
): Map<K, EstimateTally> {
  const groups = new Map<K, EstimateFact[]>();
  for (const fact of facts) {
    const value = key(fact);
    if (value === undefined) continue;
    const list = groups.get(value);
    if (list) list.push(fact);
    else groups.set(value, [fact]);
  }
  return new Map([...groups].map(([value, items]) => [value, tallyEstimates(items)]));
}

/** Every estimate-accuracy number of the report, from the facts of the scoped projects. */
export function buildEstimateBreakdown(
  facts: readonly EstimateFact[],
  periods: readonly ReportPeriod[],
): EstimateBreakdown {
  const inPeriods = facts.filter((fact) => periodIndexOf(periods, fact.completedOn) >= 0);
  const byPeriod = tallyBy(inPeriods, (fact) => periodIndexOf(periods, fact.completedOn));
  return {
    totals: tallyEstimates(inPeriods),
    byPeriod: periods.map((_, index) => byPeriod.get(index) ?? EMPTY_ESTIMATE_TALLY),
    byOwner: tallyBy(inPeriods, (fact) => fact.ownerUserId ?? undefined),
    byTaskType: tallyBy(inPeriods, (fact) => fact.taskTypeKey),
    byTemplate: tallyBy(inPeriods, (fact) => fact.templateId),
  };
}
