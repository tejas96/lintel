import type { ActivityDependencies } from './activity-dependencies';
import { createBlockerActivities } from './blocker.activities';
import { createDailyOperationsActivities } from './daily-operations.activities';
import { createDeadlineActivities } from './deadline.activities';
import { createLeaveActivities } from './leave.activities';
import { createPushDeliveryActivities } from './push-delivery.activities';
import { createReviewActivities } from './review.activities';

/**
 * Every activity the worker registers, built from injected dependencies.
 * Workflows import only the *type* of this object.
 */
export function createActivities(deps: ActivityDependencies) {
  return {
    ...createDeadlineActivities(deps),
    ...createReviewActivities(deps),
    ...createBlockerActivities(deps),
    ...createLeaveActivities(deps),
    ...createPushDeliveryActivities(deps),
    ...createDailyOperationsActivities(deps),
  };
}

export type WorkerActivities = ReturnType<typeof createActivities>;

export type { ActivityDependencies, WorkerStores } from './activity-dependencies';
export type { DeadlinePlan, DeadlinePlanStep } from './deadline-plan';
export type { FollowUpPlan, FollowUpSendResult } from './follow-up.types';
export { OrganizationContext } from './organization-context';
