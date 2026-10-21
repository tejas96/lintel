import {
  buildReworkBreakdown,
  EMPTY_REWORK_TALLY,
  mostSentBack,
  type ReportPlan,
  type ReviewOutcomeFact,
  reportInstantWindow,
} from '@lintel/application';
import { calendarDateInTimeZone } from '@lintel/shared';
import { and, eq, gte, inArray, lt, ne } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { deliverables, deliverableVersions, projects, tasks } from '../../schema';
import { loadUserSummaries } from '../shared/user-summary.query';
import type { ReportSources } from './delivery-report.query';
import { type ReportScope, resolveReportScope, teamNamesOf } from './report-scope';

const MOST_SENT_BACK_LIMIT = 10;

type NamedReviewFact = ReviewOutcomeFact & { readonly deliverableName: string };

/**
 * Versions reviewed (any decision but pending) in the window on the scoped
 * projects; with the team filter, only versions submitted by team members.
 */
async function reviewOutcomeFacts(
  db: DatabaseExecutor,
  plan: ReportPlan,
  scope: ReportScope,
  timeZone: string,
): Promise<NamedReviewFact[]> {
  if (scope.projectIds.length === 0) return [];
  const window = reportInstantWindow(plan.range, timeZone);
  const rows = await db
    .select({
      versionId: deliverableVersions.id,
      deliverableId: deliverables.id,
      deliverableName: deliverables.name,
      taskId: deliverables.taskId,
      projectId: deliverables.projectId,
      submitterUserId: deliverableVersions.submittedByUserId,
      reviewedAt: deliverableVersions.reviewedAt,
      decision: deliverableVersions.decision,
    })
    .from(deliverableVersions)
    .innerJoin(deliverables, eq(deliverables.id, deliverableVersions.deliverableId))
    .where(
      and(
        inArray(deliverables.projectId, scope.projectIds),
        ne(deliverableVersions.decision, 'pending'),
        gte(deliverableVersions.reviewedAt, window.from),
        lt(deliverableVersions.reviewedAt, window.to),
        scope.teamUserIds
          ? inArray(deliverableVersions.submittedByUserId, scope.teamUserIds)
          : undefined,
      ),
    );
  return rows.flatMap(({ reviewedAt, decision, ...row }): NamedReviewFact[] =>
    reviewedAt && decision !== 'pending'
      ? [{ ...row, decision, reviewedOn: calendarDateInTimeZone(reviewedAt, timeZone) }]
      : [],
  );
}

const projectRefColumns = {
  id: projects.id,
  reference: projects.reference,
  name: projects.name,
  colorIndex: projects.colorIndex,
};

/**
 * Rework rate: deliverable versions sent back (changes requested or rejected)
 * out of those reviewed in the range, per project, submitter, task and period.
 * Formulas: `rework-rate.metrics.ts` (application).
 */
export async function loadReworkReport(
  db: DatabaseExecutor,
  plan: ReportPlan,
  sources: ReportSources,
) {
  const scope = await resolveReportScope(db, plan);
  const facts = await reviewOutcomeFacts(db, plan, scope, sources.timeZone);
  const breakdown = buildReworkBreakdown(facts, plan.periods);
  const top = mostSentBack(breakdown.bySubject, MOST_SENT_BACK_LIMIT);
  const taskIds = top.flatMap(([, row]) => (row.subject.kind === 'task' ? [row.subject.id] : []));
  const submitterIds = [...breakdown.bySubmitter.keys()];
  const projectIds = [...breakdown.byProject.keys()];
  const [people, teams, projectRows, taskRows] = await Promise.all([
    loadUserSummaries(db, submitterIds),
    teamNamesOf(db, submitterIds),
    projectIds.length === 0
      ? Promise.resolve([])
      : db.select(projectRefColumns).from(projects).where(inArray(projects.id, projectIds)),
    taskIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: tasks.id, number: tasks.number, title: tasks.title })
          .from(tasks)
          .where(inArray(tasks.id, taskIds)),
  ]);
  const projectById = new Map(projectRows.map((row) => [row.id, row]));
  const taskById = new Map(taskRows.map((row) => [row.id, row]));
  return {
    generatedAt: sources.now.toISOString(),
    scope: plan.scope,
    range: { start: plan.range.start, end: plan.range.end },
    granularity: plan.granularity,
    totals: breakdown.totals,
    byPeriod: plan.periods.map((period, index) => ({
      start: period.start,
      end: period.end,
      ...(breakdown.byPeriod[index] ?? EMPTY_REWORK_TALLY),
    })),
    byProject: projectRows
      .flatMap((project) => {
        const tally = breakdown.byProject.get(project.id);
        return tally ? [{ project, ...tally }] : [];
      })
      .sort(
        (left, right) =>
          right.sentBack - left.sentBack ||
          right.reviewed - left.reviewed ||
          left.project.reference.localeCompare(right.project.reference),
      ),
    byPerson: submitterIds
      .flatMap((userId) => {
        const user = people.get(userId);
        const tally = breakdown.bySubmitter.get(userId);
        if (!user || !tally) return [];
        return [{ user, team: teams.get(userId)?.name ?? null, ...tally }];
      })
      .sort(
        (left, right) =>
          right.sentBack - left.sentBack || left.user.fullName.localeCompare(right.user.fullName),
      ),
    mostSentBack: top.flatMap(([, { subject, ...tally }]) => {
      const sample = facts.find((fact) =>
        subject.kind === 'task' ? fact.taskId === subject.id : fact.deliverableId === subject.id,
      );
      const project = sample ? projectById.get(sample.projectId) : undefined;
      if (!sample || !project) return [];
      const task = subject.kind === 'task' ? taskById.get(subject.id) : undefined;
      return [
        {
          kind: subject.kind,
          recordId: subject.id,
          title: task?.title ?? sample.deliverableName,
          context: task ? `${project.reference} · #${task.number}` : project.reference,
          project,
          ...tally,
        },
      ];
    }),
  };
}
