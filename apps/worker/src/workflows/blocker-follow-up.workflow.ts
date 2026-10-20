import { defineSignal, proxyActivities, setHandler } from '@temporalio/workflow';
import type { WorkerActivities } from '../activities';
import { DATABASE_ACTIVITY } from './activity-options';
import { runFollowUpStages } from './follow-up-stages';
import { type FollowUpWorkflowOutcome, SIGNALS } from './workflow-contract';

const { planBlockerFollowUp, sendBlockerFollowUp } =
  proxyActivities<WorkerActivities>(DATABASE_ACTIVITY);

export const blockerResolvedSignal = defineSignal(SIGNALS.blockerResolved);

/**
 * Follows up an unresolved blocker: the project manager after one working
 * day, the business owners (`dashboard.view_business`) after three.
 */
export async function blockerFollowUpWorkflow(blockerId: string): Promise<FollowUpWorkflowOutcome> {
  let resolved = false;
  setHandler(blockerResolvedSignal, () => {
    resolved = true;
  });
  return runFollowUpStages({
    stages: ['manager', 'owner'] as const,
    plan: () => planBlockerFollowUp(blockerId),
    send: (stage) => sendBlockerFollowUp(blockerId, stage),
    isResolved: () => resolved,
  });
}
