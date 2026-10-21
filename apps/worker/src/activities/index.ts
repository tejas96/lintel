import type { ActivityDependencies } from './activity-dependencies';
import { createBlockerActivities } from './blocker.activities';
import { type MessageChannelDependencies, unconfiguredChannels } from './channel-dependencies';
import { createDailyOperationsActivities } from './daily-operations.activities';
import { createDeadlineActivities } from './deadline.activities';
import { createEmailDigestActivities } from './email-digest.activities';
import { createLeaveActivities } from './leave.activities';
import {
  createMaintenanceActivities,
  type MaintenanceDependencies,
} from './maintenance.activities';
import { createMessageDeliveryActivities } from './message-delivery.activities';
import { createPushDeliveryActivities } from './push-delivery.activities';
import { createReviewActivities } from './review.activities';

/**
 * Every activity the worker registers, built from injected dependencies.
 * Workflows import only the *type* of this object. Without `channels`, SMS
 * and email attempts are recorded as skipped (tests, tools).
 */
export function createActivities(
  deps: ActivityDependencies,
  maintenance: MaintenanceDependencies,
  channels: MessageChannelDependencies = unconfiguredChannels(),
) {
  return {
    ...createDeadlineActivities(deps),
    ...createReviewActivities(deps),
    ...createBlockerActivities(deps),
    ...createLeaveActivities(deps),
    ...createPushDeliveryActivities(deps),
    ...createDailyOperationsActivities(deps),
    ...createMaintenanceActivities(maintenance),
    ...createMessageDeliveryActivities(deps, channels),
    ...createEmailDigestActivities(deps, channels),
  };
}

export type WorkerActivities = ReturnType<typeof createActivities>;

export type { ActivityDependencies, WorkerStores } from './activity-dependencies';
export { type MessageChannelDependencies, unconfiguredChannels } from './channel-dependencies';
export type { DeadlinePlan, DeadlinePlanStep } from './deadline-plan';
export type { EmailDigestResult, EmailDigestRun } from './email-digest.activities';
export type { FollowUpPlan, FollowUpSendResult } from './follow-up.types';
export type { MaintenanceDependencies, RewardScheduleRunner } from './maintenance.activities';
export type { MessageDeliveryResult } from './message-delivery.activities';
export { OrganizationContext } from './organization-context';
