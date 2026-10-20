import { defineSignal, proxyActivities, setHandler } from '@temporalio/workflow';
import type { WorkerActivities } from '../activities';
import { DATABASE_ACTIVITY } from './activity-options';
import { runFollowUpStages } from './follow-up-stages';
import { type FollowUpWorkflowOutcome, type ReviewSubject, SIGNALS } from './workflow-contract';

const { planReviewFollowUp, sendReviewFollowUp } =
  proxyActivities<WorkerActivities>(DATABASE_ACTIVITY);

export const reviewDecidedSignal = defineSignal(SIGNALS.reviewDecided);

/**
 * Follows up a pending review (task or deliverable version): reminds the
 * reviewer after one working day, tells the project manager two working days
 * later, and stops as soon as the review is decided.
 */
export async function reviewFollowUpWorkflow(
  subject: ReviewSubject,
): Promise<FollowUpWorkflowOutcome> {
  let decided = false;
  setHandler(reviewDecidedSignal, () => {
    decided = true;
  });
  return runFollowUpStages({
    stages: ['reviewer', 'manager'] as const,
    plan: () => planReviewFollowUp(subject),
    send: (stage) => sendReviewFollowUp(subject, stage),
    isResolved: () => decided,
  });
}
