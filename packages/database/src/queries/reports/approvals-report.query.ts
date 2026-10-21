import {
  APPROVAL_KINDS,
  type ApprovalKind,
  decidedWithin,
  elapsedHours,
  median,
  type ReportPlan,
  reportInstantWindow,
  slowestDecisions,
  summarizeTurnaround,
} from '@lintel/application';
import type { DatabaseExecutor } from '../../client';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import {
  deliverableReviewFacts,
  leaveDecisionFacts,
  type NamedDecisionFact,
  scopeChangeFacts,
} from './approval-facts';
import { type LeaveReportSources, leavePeople } from './leave-report.query';
import { resolveReportScope } from './report-scope';

const SLOWEST_LIMIT = 8;

/**
 * Approvals turnaround: deliverable reviews and scope changes on the scoped
 * projects, and leave decisions for the same people the leave report covers.
 * Formulas: `approval-turnaround.metrics.ts` (elapsed clock hours).
 */
export async function loadApprovalsReport(
  db: DatabaseExecutor,
  plan: ReportPlan,
  sources: LeaveReportSources,
) {
  const scope = await resolveReportScope(db, plan);
  const window = reportInstantWindow(plan.range, sources.timeZone);
  const [reviews, changes, leave] = await Promise.all([
    deliverableReviewFacts(db, scope.projectIds, window),
    scopeChangeFacts(db, scope.projectIds, window),
    leavePeople(db, plan, sources.audience).then((people) =>
      leaveDecisionFacts(db, people, window),
    ),
  ]);
  const facts: NamedDecisionFact[] = [...reviews, ...changes, ...leave];
  const decided = facts.filter((fact) => decidedWithin(fact, window));
  const people = await loadUserSummaries(
    db,
    decided.map((fact) => fact.deciderUserId),
  );
  const byDecider = new Map<string, { kind: ApprovalKind; userId: string; hours: number[] }>();
  for (const fact of decided) {
    if (!fact.deciderUserId || !fact.decidedAt) continue;
    const key = `${fact.kind}:${fact.deciderUserId}`;
    const entry = byDecider.get(key) ?? { kind: fact.kind, userId: fact.deciderUserId, hours: [] };
    entry.hours.push(elapsedHours(fact.requestedAt, fact.decidedAt));
    byDecider.set(key, entry);
  }
  return {
    generatedAt: sources.now.toISOString(),
    scope: plan.scope,
    range: { start: plan.range.start, end: plan.range.end },
    granularity: plan.granularity,
    kinds: APPROVAL_KINDS.map((kind) => {
      const summary = summarizeTurnaround(
        facts.filter((fact) => fact.kind === kind),
        window,
        sources.now,
      );
      const { slowest: _slowest, ...numbers } = summary;
      return { kind, ...numbers };
    }),
    byDecider: [...byDecider.values()]
      .flatMap((entry) => {
        const decider = people.get(entry.userId);
        if (!decider) return [];
        return [
          {
            kind: entry.kind,
            decider,
            decided: entry.hours.length,
            medianHours: median(entry.hours),
            slowestHours: Math.max(...entry.hours),
          },
        ];
      })
      .sort(
        (left, right) =>
          APPROVAL_KINDS.indexOf(left.kind) - APPROVAL_KINDS.indexOf(right.kind) ||
          (right.medianHours ?? 0) - (left.medianHours ?? 0),
      ),
    slowest: slowestDecisions(decided, window, SLOWEST_LIMIT).flatMap(({ fact, hours }) => {
      const named = decided.find((item) => item.id === fact.id && item.kind === fact.kind);
      if (!named?.decidedAt) return [];
      return [
        {
          kind: named.kind,
          recordId: named.recordId,
          projectId: named.projectId,
          title: named.title,
          context: named.context,
          requestedAt: named.requestedAt.toISOString(),
          decidedAt: named.decidedAt.toISOString(),
          hours,
          decider: pickUser(people, named.deciderUserId),
        },
      ];
    }),
  };
}
