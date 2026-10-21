import {
  type CommandCenterPlan,
  HEALTH_TREND_DAYS,
  healthScopeKey,
  overloadedPeople,
  projectsNeedingAttention,
} from '@lintel/application';
import {
  type BusinessHealthScore,
  type HealthComponent,
  type HealthComponentKey,
  scoreBusinessHealth,
} from '@lintel/domain';
import { addDays, type CalendarDate } from '@lintel/shared';
import { and, asc, count, eq, gte, isNull, lt } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { businessHealthSnapshots, taskBlockers, tasks } from '../../schema';
import { activeProjectSummaries } from '../operations/command-center/command-center-projects';
import type { CommandCenterScope } from '../operations/command-center/command-center-scope';
import {
  openTask,
  scopedTasks,
  taskCounts,
} from '../operations/command-center/command-center-tasks';
import type { UtilisationSource } from '../operations/command-center/command-center-team';
import type { ProjectSummaryView } from '../shared/project-summary.query';
import { countStaleDecisions } from './stale-decisions.query';

export interface HealthContributorView extends HealthComponent {
  readonly link: { readonly label: string; readonly linkPath: string };
}

export interface BusinessHealthView extends Omit<BusinessHealthScore, 'contributors' | 'components'> {
  readonly components: HealthComponent[];
  readonly contributors: HealthContributorView[];
  readonly trend: {
    /** Null when the view has no recorded readings (project or team filter). */
    readonly scopeKey: string | null;
    readonly points: { readonly date: string; readonly score: number }[];
    /** The reading a week ago (or the earliest one after it), for the change. */
    readonly previousScore: number | null;
    readonly previousOn: string | null;
  };
}

/** Where each part of the score points: the record that explains it best. */
type Links = Record<HealthComponentKey, { label: string; linkPath: string }>;

async function causeLinks(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
  summaries: readonly ProjectSummaryView[],
  today: CalendarDate,
): Promise<Links> {
  const none = scope.projectIds.length === 0;
  const [overdue] = none
    ? []
    : await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(scopedTasks(scope), openTask, lt(tasks.dueDate, today)))
        .orderBy(asc(tasks.dueDate))
        .limit(1);
  const [blocked] = none
    ? []
    : await db
        .select({ id: taskBlockers.taskId })
        .from(taskBlockers)
        .innerJoin(tasks, eq(tasks.id, taskBlockers.taskId))
        .where(and(isNull(taskBlockers.resolvedAt), scopedTasks(scope)))
        .orderBy(asc(taskBlockers.raisedAt))
        .limit(1);
  const [worst] = projectsNeedingAttention(summaries, 1);
  return {
    delivery_risk: worst
      ? { label: `Open ${worst.reference}`, linkPath: `/projects/${worst.id}` }
      : { label: 'See projects', linkPath: '/projects' },
    overdue_work: overdue
      ? { label: 'Open the most overdue task', linkPath: `/tasks/${overdue.id}` }
      : { label: 'See projects', linkPath: '/projects' },
    blocked_work: blocked
      ? { label: 'Open the oldest blocker', linkPath: `/tasks/${blocked.id}` }
      : { label: 'See projects', linkPath: '/projects' },
    decisions_waiting: { label: 'Open approvals', linkPath: '/approvals' },
    capacity_strain: { label: 'Open capacity', linkPath: '/capacity' },
  };
}

/** The live score for a view, from the same counts the command center shows. */
export async function computeBusinessHealth(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
  plan: CommandCenterPlan,
  utilisation: UtilisationSource,
  now: Date,
): Promise<{ score: BusinessHealthScore; summaries: ProjectSummaryView[] }> {
  const [summaries, counts, open, stale, load] = await Promise.all([
    activeProjectSummaries(db, scope, plan.today),
    taskCounts(db, scope, plan.today),
    scope.projectIds.length === 0
      ? Promise.resolve([{ total: 0 }])
      : db
          .select({ total: count() })
          .from(tasks)
          .where(and(scopedTasks(scope), openTask)),
    countStaleDecisions(db, scope, now),
    scope.peopleIds.length === 0
      ? Promise.resolve([])
      : utilisation(scope.peopleIds, plan.remainingWeek),
  ]);
  const health = (status: string) =>
    summaries.filter((item) => item.health.status === status).length;
  const score = scoreBusinessHealth({
    activeProjects: scope.activeProjectIds.length,
    projectsOffTrack: health('off_track'),
    projectsAtRisk: health('at_risk'),
    openTasks: open[0]?.total ?? 0,
    overdueTasks: counts.overdue,
    blockedTasks: counts.blocked,
    staleDecisions: stale,
    peopleInView: scope.peopleIds.length,
    overloadedPeople: overloadedPeople(load).length,
  });
  return { score, summaries };
}

/** Recorded readings for the view plus today's live score as the last point. */
async function healthTrend(
  db: DatabaseExecutor,
  plan: CommandCenterPlan,
  liveScore: number,
): Promise<BusinessHealthView['trend']> {
  const scopeKey = healthScopeKey(plan);
  if (!scopeKey) return { scopeKey, points: [], previousScore: null, previousOn: null };
  const rows = await db
    .select({ date: businessHealthSnapshots.recordedOn, score: businessHealthSnapshots.score })
    .from(businessHealthSnapshots)
    .where(
      and(
        eq(businessHealthSnapshots.scopeKey, scopeKey),
        gte(businessHealthSnapshots.recordedOn, addDays(plan.today, -HEALTH_TREND_DAYS)),
        lt(businessHealthSnapshots.recordedOn, plan.today),
      ),
    )
    .orderBy(asc(businessHealthSnapshots.recordedOn));
  const weekAgo = addDays(plan.today, -7);
  const previous = rows.find((row) => row.date >= weekAgo) ?? null;
  return {
    scopeKey,
    points: [...rows, { date: plan.today, score: liveScore }],
    previousScore: previous?.score ?? null,
    previousOn: previous?.date ?? null,
  };
}

/** The business health score with its contributors' links and its recorded trend. */
export async function loadBusinessHealth(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
  plan: CommandCenterPlan,
  utilisation: UtilisationSource,
  now: Date,
): Promise<BusinessHealthView> {
  const { score, summaries } = await computeBusinessHealth(db, scope, plan, utilisation, now);
  const [links, trend] = await Promise.all([
    causeLinks(db, scope, summaries, plan.today),
    healthTrend(db, plan, score.score),
  ]);
  return {
    ...score,
    components: [...score.components],
    contributors: score.contributors.map((part) => ({ ...part, link: links[part.key] })),
    trend,
  };
}
