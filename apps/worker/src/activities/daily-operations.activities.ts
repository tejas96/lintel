import { MILESTONE_HEALTH_ACTIVITY, type ProjectRiskFacts } from '@lintel/application';
import type { CalendarDate } from '@lintel/shared';
import { WORKFLOW_IDS, WORKFLOW_TYPES } from '../workflows/workflow-contract';
import { type ActivityDependencies, withNotifier } from './activity-dependencies';
import {
  changedMilestones,
  isRisky,
  milestoneHealthLabel,
  projectRiskDedupeKey,
  projectRiskNotification,
} from './project-risk-messages';

export interface ProjectRiskSummary {
  readonly projectsChecked: number;
  readonly projectsNotified: number;
  readonly milestoneChanges: number;
}

export interface DeadlineHealSummary {
  readonly started: number;
}

export interface HealthSnapshotSummary {
  readonly recorded: number;
}

/** Open tasks re-armed per daily run; the rest follow on the next run. */
const HEAL_BATCH_SIZE = 200;

async function reviewProject(
  deps: ActivityDependencies,
  project: ProjectRiskFacts,
  today: CalendarDate,
): Promise<{ notified: boolean; changes: number }> {
  return withNotifier(deps, async (stores, notifier) => {
    const operations = stores.background.operations;
    // Already told today: leave changes unrecorded so tomorrow's run still reports them.
    if (
      await operations.notificationExists(
        project.managerUserId,
        projectRiskDedupeKey(project, today),
      )
    ) {
      return { notified: false, changes: 0 };
    }
    const lastRecorded = await operations.lastRecordedMilestoneHealth(
      project.milestones.map((milestone) => milestone.id),
    );
    const changed = changedMilestones(project, lastRecorded);
    for (const milestone of changed) {
      await stores.records.appendActivity({
        projectId: project.projectId,
        taskId: null,
        actorUserId: null,
        type: MILESTONE_HEALTH_ACTIVITY,
        summary: `Milestone "${milestone.name}" is now ${milestoneHealthLabel(milestone.assessment.health)}.`,
        payload: {
          milestoneId: milestone.id,
          health: milestone.assessment.health,
          reasons: [...milestone.assessment.reasons],
        },
      });
    }
    const newlyRisky = changed.filter(isRisky);
    if (newlyRisky.length === 0 && project.health.status !== 'off_track') {
      return { notified: false, changes: changed.length };
    }
    await notifier.notify(projectRiskNotification(project, newlyRisky, today));
    return { notified: true, changes: changed.length };
  });
}

/** Activities of `dailyOperationsWorkflow`. */
export function createDailyOperationsActivities(deps: ActivityDependencies) {
  return {
    /**
     * Tells project managers about milestones newly at risk or missed and
     * about projects that are off track: at most one notification per
     * project per day (dedupe key with today's date).
     */
    async notifyProjectRisks(): Promise<ProjectRiskSummary> {
      const today = await deps.organization.today();
      const projects = await deps.uow.stores.background.operations.activeProjectRisks(today);
      let projectsNotified = 0;
      let milestoneChanges = 0;
      for (const project of projects) {
        const result = await reviewProject(deps, project, today);
        if (result.notified) projectsNotified += 1;
        milestoneChanges += result.changes;
      }
      deps.logger.info('Project risk review finished', {
        projectsChecked: projects.length,
        projectsNotified,
        milestoneChanges,
      });
      return { projectsChecked: projects.length, projectsNotified, milestoneChanges };
    },

    /**
     * Records today's business health score for the studio and for each
     * project manager (the command center trend). Rerunning on the same day
     * replaces the day's reading, so retries are safe.
     */
    async recordBusinessHealth(): Promise<HealthSnapshotSummary> {
      const today = await deps.organization.today();
      const result = await deps.uow.stores.background.insights.recordBusinessHealth(
        today,
        deps.clock.now(),
      );
      deps.logger.info('Business health recorded', { scopes: result.recorded });
      return { recorded: result.recorded };
    },

    /** Self-heal: starts a deadline workflow for open tasks that never had one. */
    async healDeadlineWorkflows(): Promise<DeadlineHealSummary> {
      const workflowRuns = deps.uow.stores.background.workflowRuns;
      const taskIds = await workflowRuns.openTasksWithoutDeadlineWorkflow(
        WORKFLOW_IDS.taskDeadlinePrefix,
        HEAL_BATCH_SIZE,
      );
      for (const taskId of taskIds) {
        const workflowId = WORKFLOW_IDS.taskDeadline(taskId);
        await deps.scheduler.start({
          workflowType: WORKFLOW_TYPES.taskDeadline,
          workflowId,
          args: [taskId],
        });
        await workflowRuns.record(
          {
            workflowType: WORKFLOW_TYPES.taskDeadline,
            workflowId,
            subjectType: 'task',
            subjectId: taskId,
            sourceEventId: null,
            signalled: false,
          },
          deps.clock.now(),
        );
      }
      if (taskIds.length > 0)
        deps.logger.info('Deadline workflows re-armed', { started: taskIds.length });
      return { started: taskIds.length };
    },
  };
}
