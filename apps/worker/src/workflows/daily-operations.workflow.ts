import { proxyActivities } from '@temporalio/workflow';
import type { WorkerActivities } from '../activities';
import { BATCH_ACTIVITY } from './activity-options';

const { notifyProjectRisks, healDeadlineWorkflows, purgeSecurityRecords } =
  proxyActivities<WorkerActivities>(BATCH_ACTIVITY);

export interface DailyOperationsOutcome {
  readonly projectsChecked: number;
  readonly projectsNotified: number;
  readonly milestoneChanges: number;
  readonly deadlineWorkflowsStarted: number;
  readonly securityRecordsPurged: number;
}

/**
 * Run every morning by the `lintel-daily-operations` Schedule: risk alerts
 * for project managers, self-healing of missing deadline workflows, and
 * purging expired sign-in records.
 */
export async function dailyOperationsWorkflow(): Promise<DailyOperationsOutcome> {
  const [risks, healed, purged] = await Promise.all([
    notifyProjectRisks(),
    healDeadlineWorkflows(),
    purgeSecurityRecords(),
  ]);
  const securityRecordsPurged =
    purged.rateLimitCounters + purged.otpChallenges + purged.sessions + purged.idempotencyRecords;
  return { ...risks, deadlineWorkflowsStarted: healed.started, securityRecordsPurged };
}
