import {
  type CommandCenterPlan,
  countKpi,
  onTimeDeliveryKpi,
  projectsNeedingAttention,
  weeklyDeliveryTrend,
} from '@lintel/application';
import type { Capability } from '@lintel/domain';
import { eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../client';
import { projects } from '../../../schema';
import { loadApprovalQueue } from '../../approvals/approval-queue.query';
import { portfolioProfitability } from './command-center-finances';
import {
  activeProjectSummaries,
  scopeChangesAwaitingDecision,
  upcomingMilestones,
} from './command-center-projects';
import { resolveCommandCenterScope } from './command-center-scope';
import {
  completionFacts,
  criticalTasksToday,
  openBlockers,
  taskCounts,
} from './command-center-tasks';
import {
  leaveAwaitingDecision,
  rewardsSummary,
  teamSection,
  type UtilisationSource,
} from './command-center-team';

export interface CommandCenterSources {
  readonly timeZone: string;
  readonly currency: string;
  readonly viewerCapabilities: ReadonlySet<Capability>;
  readonly utilisation: UtilisationSource;
  readonly now: Date;
  /** The studio setting; budgets and costs appear only when it is on. */
  readonly profitabilityEnabled: boolean;
}

const ATTENTION_LIMIT = 8;
const APPROVALS_LIMIT = 8;

/** Whether the person manages at least one live project (for the manager view). */
export async function managesAnyProject(db: DatabaseExecutor, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.managerUserId, userId))
    .limit(1);
  return Boolean(row);
}

/**
 * The command center, computed from live records for the plan's scope.
 * Formulas: see `command-center.metrics.ts` (application) and the section
 * loaders; every count is a count of rows, never an estimate.
 */
export async function loadCommandCenter(
  db: DatabaseExecutor,
  plan: CommandCenterPlan,
  sources: CommandCenterSources,
) {
  const scope = await resolveCommandCenterScope(db, plan);
  const [
    summaries,
    counts,
    completions,
    milestones,
    critical,
    blockers,
    approvals,
    team,
    leave,
    scopeChanges,
    profitability,
  ] = await Promise.all([
    activeProjectSummaries(db, scope, plan.today),
    taskCounts(db, scope, plan.today),
    completionFacts(db, scope, plan, sources.timeZone),
    upcomingMilestones(db, scope, plan),
    criticalTasksToday(db, scope, plan.today),
    openBlockers(db, scope, plan.today),
    loadApprovalQueue(
      db,
      { userId: plan.viewerUserId, capabilities: sources.viewerCapabilities },
      plan.today,
    ),
    teamSection(db, scope, plan, sources.utilisation),
    leaveAwaitingDecision(db, scope, plan),
    scopeChangesAwaitingDecision(db, scope),
    sources.profitabilityEnabled
      ? portfolioProfitability(
          db,
          scope,
          {
            userId: plan.viewerUserId,
            seesAllBudgets: sources.viewerCapabilities.has('projects.manage_any'),
          },
          sources.currency,
        )
      : Promise.resolve(null),
  ]);
  const healthCount = (status: string) =>
    summaries.filter((project) => project.health.status === status).length;
  return {
    generatedAt: sources.now.toISOString(),
    range: { start: plan.range.start, end: plan.range.end },
    kpis: {
      // Active projects: scoped projects whose status is "active".
      activeProjects: countKpi(scope.activeProjectIds.length),
      // At risk / off track: active projects by the domain health calculator.
      projectsAtRisk: countKpi(healthCount('at_risk')),
      projectsOffTrack: countKpi(healthCount('off_track')),
      overdueTasks: countKpi(counts.overdue),
      blockedTasks: countKpi(counts.blocked),
      dueToday: countKpi(counts.dueToday),
      // Pending approvals: everything in the viewer's own approval queue.
      pendingApprovals: countKpi(approvals.length),
      onTimeDeliveryRate: onTimeDeliveryKpi(completions, plan.range, plan.previousRange),
    },
    projectsNeedingAttention: projectsNeedingAttention(summaries, ATTENTION_LIMIT).map(
      (project) => ({
        ...project,
        health: { ...project.health, reasons: [...project.health.reasons] },
      }),
    ),
    upcomingMilestones: milestones,
    criticalToday: critical,
    blockers,
    approvals: approvals.slice(0, APPROVALS_LIMIT),
    team,
    leaveAwaitingDecision: leave,
    scopeChangesAwaitingDecision: scopeChanges,
    deliveryTrend: weeklyDeliveryTrend(completions, plan.trendEndsOn, plan.trendWeeks),
    rewards: plan.includeRewards
      ? await rewardsSummary(db, plan, sources.timeZone, sources.currency)
      : null,
    profitability,
  };
}
