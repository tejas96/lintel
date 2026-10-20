import { proxyActivities } from '@temporalio/workflow';
import type { WorkerActivities } from '../activities';
import { BATCH_ACTIVITY } from './activity-options';

const { notifyProjectRisks, healDeadlineWorkflows } =
  proxyActivities<WorkerActivities>(BATCH_ACTIVITY);

export interface DailyOperationsOutcome {
  readonly projectsChecked: number;
  readonly projectsNotified: number;
  readonly milestoneChanges: number;
  readonly deadlineWorkflowsStarted: number;
}

/**
 * Run every morning by the `lintel-daily-operations` Schedule: risk alerts
 * for project managers, and self-healing of missing deadline workflows.
 */
export async function dailyOperationsWorkflow(): Promise<DailyOperationsOutcome> {
  const [risks, healed] = await Promise.all([notifyProjectRisks(), healDeadlineWorkflows()]);
  return { ...risks, deadlineWorkflowsStarted: healed.started };
}
