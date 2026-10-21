import type { CommandCenterPlan } from '@lintel/application';
import type { CalendarDate } from '@lintel/shared';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../client';
import {
  milestones,
  projects,
  scopeChangeRequests,
  scopeChangeTaskImpacts,
  tasks,
} from '../../../schema';
import { loadClientSignOffViews } from '../../projects/scope-change-sign-offs.query';
import { loadProjectHealth } from '../../shared/project-health.loader';
import { loadProjectSummaries } from '../../shared/project-summary.query';
import { loadUserSummaries, pickUser } from '../../shared/user-summary.query';
import type { CommandCenterScope } from './command-center-scope';

const SECTION_LIMIT = 10;

/** Active scoped projects with their computed health (the shared summary read model). */
export function activeProjectSummaries(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
  today: CalendarDate,
) {
  if (scope.activeProjectIds.length === 0) return Promise.resolve([]);
  return loadProjectSummaries(db, {
    where: inArray(projects.id, scope.activeProjectIds),
    limit: 500,
    today,
  });
}

/** Pending milestones due from today through the next 14 days, with their risk. */
export async function upcomingMilestones(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
  plan: CommandCenterPlan,
) {
  if (scope.projectIds.length === 0) return [];
  const rows = await db
    .select({
      milestone: milestones,
      project: {
        id: projects.id,
        reference: projects.reference,
        name: projects.name,
        colorIndex: projects.colorIndex,
        status: projects.status,
        plannedEndDate: projects.plannedEndDate,
      },
    })
    .from(milestones)
    .innerJoin(projects, eq(projects.id, milestones.projectId))
    .where(
      and(
        inArray(milestones.projectId, scope.projectIds),
        eq(milestones.status, 'pending'),
        gte(milestones.dueDate, plan.milestoneHorizon.start),
        lte(milestones.dueDate, plan.milestoneHorizon.end),
      ),
    )
    .orderBy(asc(milestones.dueDate))
    .limit(SECTION_LIMIT);
  const health = await loadProjectHealth(
    db,
    [...new Map(rows.map((row) => [row.project.id, row.project])).values()],
    plan.today,
  );
  return rows.map(({ milestone, project }) => {
    const risk = health.get(project.id)?.milestoneRisk.get(milestone.id);
    return {
      milestone: {
        id: milestone.id,
        stageId: milestone.stageId,
        name: milestone.name,
        dueDate: milestone.dueDate,
        baselineDueDate: milestone.baselineDueDate,
        status: milestone.status,
        health: risk?.health ?? 'on_track',
        riskReasons: [...(risk?.reasons ?? [])],
        requiresClientApproval: milestone.requiresClientApproval,
        openTaskCount: risk?.openTaskCount ?? 0,
        completedAt: milestone.completedAt?.toISOString() ?? null,
        version: milestone.version,
      },
      project: {
        id: project.id,
        reference: project.reference,
        name: project.name,
        colorIndex: project.colorIndex,
      },
    };
  });
}

/**
 * Proposed scope changes on scoped projects. The project end impact is the
 * largest working-day shift among the affected tasks.
 */
export async function scopeChangesAwaitingDecision(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
) {
  if (scope.projectIds.length === 0) return [];
  const changes = await db
    .select()
    .from(scopeChangeRequests)
    .where(
      and(
        inArray(scopeChangeRequests.projectId, scope.projectIds),
        eq(scopeChangeRequests.status, 'proposed'),
      ),
    )
    .orderBy(asc(scopeChangeRequests.createdAt))
    .limit(SECTION_LIMIT);
  if (changes.length === 0) return [];
  const [impacts, people, signOffs] = await Promise.all([
    db
      .select({ impact: scopeChangeTaskImpacts, taskTitle: tasks.title })
      .from(scopeChangeTaskImpacts)
      .innerJoin(tasks, eq(tasks.id, scopeChangeTaskImpacts.taskId))
      .where(
        inArray(
          scopeChangeTaskImpacts.scopeChangeId,
          changes.map((change) => change.id),
        ),
      ),
    loadUserSummaries(
      db,
      changes.flatMap((change) => [change.requestedByUserId, change.decidedByUserId]),
    ),
    loadClientSignOffViews(
      db,
      changes.map((change) => change.id),
    ),
  ]);
  return changes.flatMap((change) => {
    const requestedBy = pickUser(people, change.requestedByUserId);
    if (!requestedBy) return [];
    const own = impacts.filter((row) => row.impact.scopeChangeId === change.id);
    return [
      {
        id: change.id,
        projectId: change.projectId,
        title: change.title,
        description: change.description,
        status: change.status,
        requestedBy,
        decidedBy: pickUser(people, change.decidedByUserId),
        decidedAt: change.decidedAt?.toISOString() ?? null,
        decisionNote: change.decisionNote,
        impacts: own.map(({ impact, taskTitle }) => ({
          taskId: impact.taskId,
          taskTitle,
          currentDueDate: impact.currentDueDate,
          proposedDueDate: impact.proposedDueDate,
          currentStartDate: impact.currentStartDate,
          proposedStartDate: impact.proposedStartDate,
          shiftWorkingDays: impact.shiftWorkingDays,
          isDownstream: impact.isDownstream,
          appliesExactDates: impact.appliesExactDates,
        })),
        projectEndImpactDays: Math.max(0, ...own.map(({ impact }) => impact.shiftWorkingDays)),
        requiresClientSignOff: change.requiresClientSignOff,
        clientSignOffs: signOffs.get(change.id) ?? [],
        // The command center lists decisions waiting; money stays on the project's scope tab.
        money: null,
        createdAt: change.createdAt.toISOString(),
        version: change.version,
      },
    ];
  });
}
