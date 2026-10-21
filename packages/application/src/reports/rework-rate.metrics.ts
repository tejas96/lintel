import type { CalendarDate } from '@lintel/shared';
import { periodIndexOf, type ReportPeriod } from './report-periods';

export type ReviewDecision = 'approved' | 'changes_requested' | 'rejected';

/** A deliverable version reviewed (decision other than pending) in the range. */
export interface ReviewOutcomeFact {
  readonly versionId: string;
  readonly deliverableId: string;
  /** The deliverable's task; null for deliverables that belong to no task. */
  readonly taskId: string | null;
  readonly projectId: string;
  readonly submitterUserId: string;
  /** Review day in the studio timezone. */
  readonly reviewedOn: CalendarDate;
  readonly decision: ReviewDecision;
}

/** Sent back = changes requested or rejected: the work has to be done again. */
export function isSentBack(decision: ReviewDecision): boolean {
  return decision === 'changes_requested' || decision === 'rejected';
}

export interface ReworkTally {
  readonly reviewed: number;
  readonly approved: number;
  readonly changesRequested: number;
  readonly rejected: number;
  /** Changes requested + rejected. */
  readonly sentBack: number;
  /** Sent back ÷ reviewed, to 0.001; null when nothing was reviewed. */
  readonly reworkRate: number | null;
}

export const EMPTY_REWORK_TALLY: ReworkTally = {
  reviewed: 0,
  approved: 0,
  changesRequested: 0,
  rejected: 0,
  sentBack: 0,
  reworkRate: null,
};

export function tallyRework(facts: readonly Pick<ReviewOutcomeFact, 'decision'>[]): ReworkTally {
  const count = (decision: ReviewDecision) =>
    facts.filter((fact) => fact.decision === decision).length;
  const sentBack = facts.filter((fact) => isSentBack(fact.decision)).length;
  return {
    reviewed: facts.length,
    approved: count('approved'),
    changesRequested: count('changes_requested'),
    rejected: count('rejected'),
    sentBack,
    reworkRate: facts.length === 0 ? null : Math.round((sentBack / facts.length) * 1000) / 1000,
  };
}

/** What a rework row is about: a task, or a deliverable that belongs to no task. */
export type ReworkSubject =
  | { readonly kind: 'task'; readonly id: string }
  | { readonly kind: 'deliverable'; readonly id: string };

export function reworkSubjectOf(fact: ReviewOutcomeFact): ReworkSubject {
  return fact.taskId
    ? { kind: 'task', id: fact.taskId }
    : { kind: 'deliverable', id: fact.deliverableId };
}

export interface ReworkBreakdown {
  readonly totals: ReworkTally;
  /** One entry per plan period, in order, by review day. */
  readonly byPeriod: readonly ReworkTally[];
  readonly byProject: ReadonlyMap<string, ReworkTally>;
  /** By the person who submitted the version. */
  readonly bySubmitter: ReadonlyMap<string, ReworkTally>;
  /** Keyed `task:<id>` or `deliverable:<id>`. */
  readonly bySubject: ReadonlyMap<string, ReworkTally & { subject: ReworkSubject }>;
}

function groupFacts<K>(
  facts: readonly ReviewOutcomeFact[],
  key: (fact: ReviewOutcomeFact) => K,
): Map<K, ReviewOutcomeFact[]> {
  const groups = new Map<K, ReviewOutcomeFact[]>();
  for (const fact of facts) {
    const value = key(fact);
    const list = groups.get(value);
    if (list) list.push(fact);
    else groups.set(value, [fact]);
  }
  return groups;
}

const tallyGroups = <K>(groups: Map<K, ReviewOutcomeFact[]>) =>
  new Map([...groups].map(([key, items]) => [key, tallyRework(items)]));

/** Every rework number of the report, from the reviews on the scoped projects. */
export function buildReworkBreakdown(
  facts: readonly ReviewOutcomeFact[],
  periods: readonly ReportPeriod[],
): ReworkBreakdown {
  const inPeriods = facts.filter((fact) => periodIndexOf(periods, fact.reviewedOn) >= 0);
  const byPeriod = tallyGroups(
    groupFacts(inPeriods, (fact) => periodIndexOf(periods, fact.reviewedOn)),
  );
  const subjects = groupFacts(inPeriods, (fact) => {
    const subject = reworkSubjectOf(fact);
    return `${subject.kind}:${subject.id}`;
  });
  return {
    totals: tallyRework(inPeriods),
    byPeriod: periods.map((_, index) => byPeriod.get(index) ?? EMPTY_REWORK_TALLY),
    byProject: tallyGroups(groupFacts(inPeriods, (fact) => fact.projectId)),
    bySubmitter: tallyGroups(groupFacts(inPeriods, (fact) => fact.submitterUserId)),
    bySubject: new Map(
      [...subjects].flatMap(([key, items]) => {
        const first = items[0];
        return first ? [[key, { ...tallyRework(items), subject: reworkSubjectOf(first) }]] : [];
      }),
    ),
  };
}

/** The subjects sent back most, then reviewed most; at most `limit`. */
export function mostSentBack<T extends ReworkTally>(
  rows: Iterable<[string, T]>,
  limit: number,
): [string, T][] {
  return [...rows]
    .filter(([, tally]) => tally.sentBack > 0)
    .sort(
      ([leftKey, left], [rightKey, right]) =>
        right.sentBack - left.sentBack ||
        right.reviewed - left.reviewed ||
        leftKey.localeCompare(rightKey),
    )
    .slice(0, limit);
}
