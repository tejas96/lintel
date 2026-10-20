import { proxyActivities } from '@temporalio/workflow';
import type { WorkerActivities } from '../activities';
import { BATCH_ACTIVITY } from './activity-options';

const { runPeriodicRewardEvaluations } = proxyActivities<WorkerActivities>(BATCH_ACTIVITY);

/**
 * Run on the first day of each month by the `lintel-periodic-rewards`
 * Schedule: evaluates every active policy for the period that just closed.
 * Evaluations are upserts on (policy, subject, period), so reruns are safe and
 * decided evaluations are never changed.
 */
export async function periodicRewardEvaluationWorkflow() {
  return runPeriodicRewardEvaluations();
}
