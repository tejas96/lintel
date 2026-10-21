import { patched, proxyActivities } from '@temporalio/workflow';
import type { WorkerActivities } from '../activities';
import { BATCH_ACTIVITY } from './activity-options';

const { notifyProjectRisks, healDeadlineWorkflows, purgeSecurityRecords, recordBusinessHealth } =
  proxyActivities<WorkerActivities>(BATCH_ACTIVITY);

/** Marks runs that also record the business health score (replay-safe for runs started before). */
export const HEALTH_SNAPSHOT_PATCH = 'record-business-health';

export interface DailyOperationsOutcome {
  readonly projectsChecked: number;
  readonly projectsNotified: number;
  readonly milestoneChanges: number;
  readonly deadlineWorkflowsStarted: number;
  readonly securityRecordsPurged: number;
  readonly healthScopesRecorded: number;
}

/**
 * Run every morning by the `lintel-daily-operations` Schedule: risk alerts
 * for project managers, self-healing of missing deadline workflows,
 * purging expired sign-in records, and the day's business health reading.
 */
export async function dailyOperationsWorkflow(): Promise<DailyOperationsOutcome> {
  const [risks, healed, purged] = await Promise.all([
    notifyProjectRisks(),
    healDeadlineWorkflows(),
    purgeSecurityRecords(),
  ]);
  const securityRecordsPurged =
    purged.rateLimitCounters + purged.otpChallenges + purged.sessions + purged.idempotencyRecords;
  // After the risk review, so the reading matches what managers were told this morning.
  const health = patched(HEALTH_SNAPSHOT_PATCH) ? await recordBusinessHealth() : { recorded: 0 };
  return {
    ...risks,
    deadlineWorkflowsStarted: healed.started,
    securityRecordsPurged,
    healthScopesRecorded: health.recorded,
  };
}
