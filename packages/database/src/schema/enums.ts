import {
  CLIENT_SIGN_OFF_METHODS,
  DATE_CHANGE_STATUSES,
  DAY_PORTIONS,
  DELIVERABLE_STATUSES,
  DOCUMENT_FOLDERS,
  LEAVE_STATUSES,
  MILESTONE_STATUSES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_KINDS,
  PROJECT_COST_CATEGORIES,
  PROJECT_CRITICALITIES,
  PROJECT_ROLES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  REASSIGNMENT_STATUSES,
  REWARD_EVALUATION_STATUSES,
  REWARD_PERIODS,
  REWARD_SCOPES,
  ROLES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '@lintel/domain';
import { pgEnum } from 'drizzle-orm/pg-core';

/** Database enums mirror the domain constants so both always agree. */
export const roleEnum = pgEnum('role', ROLES);
export const projectRoleEnum = pgEnum('project_role', PROJECT_ROLES);
export const userStatusEnum = pgEnum('user_status', ['invited', 'active', 'deactivated']);
export const projectStatusEnum = pgEnum('project_status', PROJECT_STATUSES);
export const projectTypeEnum = pgEnum('project_type', PROJECT_TYPES);
export const projectCriticalityEnum = pgEnum('project_criticality', PROJECT_CRITICALITIES);
export const stageStatusEnum = pgEnum('stage_status', [
  'pending',
  'active',
  'completed',
  'skipped',
]);
export const milestoneStatusEnum = pgEnum('milestone_status', MILESTONE_STATUSES);
export const templateVersionStatusEnum = pgEnum('template_version_status', [
  'draft',
  'published',
  'retired',
]);
export const taskStatusEnum = pgEnum('task_status', TASK_STATUSES);
export const taskPriorityEnum = pgEnum('task_priority', TASK_PRIORITIES);
export const blockerCategoryEnum = pgEnum('blocker_category', [
  'client',
  'supplier',
  'internal_dependency',
  'manager_decision',
  'information',
  'other',
]);
export const deliverableStatusEnum = pgEnum('deliverable_status', DELIVERABLE_STATUSES);
export const reviewDecisionEnum = pgEnum('review_decision', [
  'pending',
  'approved',
  'changes_requested',
  'rejected',
]);
export const fileVisibilityEnum = pgEnum('file_visibility', ['project', 'confidential', 'private']);
export const fileStatusEnum = pgEnum('file_status', ['available', 'deleted']);
export const scopeChangeStatusEnum = pgEnum('scope_change_status', [
  'proposed',
  'approved',
  'rejected',
  'withdrawn',
]);
export const leaveStatusEnum = pgEnum('leave_status', LEAVE_STATUSES);
export const dayPortionEnum = pgEnum('day_portion', DAY_PORTIONS);
export const approvalStepStatusEnum = pgEnum('approval_step_status', [
  'waiting',
  'pending',
  'approved',
  'rejected',
  'skipped',
]);
export const handoverStatusEnum = pgEnum('handover_status', [
  'proposed',
  'accepted',
  'declined',
  'applied',
]);
export const rewardScopeEnum = pgEnum('reward_scope', REWARD_SCOPES);
export const rewardPeriodEnum = pgEnum('reward_period', REWARD_PERIODS);
export const rewardEvaluationStatusEnum = pgEnum(
  'reward_evaluation_status',
  REWARD_EVALUATION_STATUSES,
);
export const notificationKindEnum = pgEnum('notification_kind', NOTIFICATION_KINDS);
export const notificationChannelEnum = pgEnum('notification_channel', NOTIFICATION_CHANNELS);
export const deliveryStatusEnum = pgEnum('delivery_status', [
  'pending',
  'deferred',
  'sent',
  'failed',
  'skipped',
  // An email held for the person's daily digest.
  'digest',
]);
export const devicePlatformEnum = pgEnum('device_platform', ['ios', 'android', 'web']);
export const pushTokenTypeEnum = pgEnum('push_token_type', ['fcm', 'apns', 'fcm_fid']);
/** How one SMS/email send attempt ended; null on the row while it is in flight. */
export const deliveryAttemptOutcomeEnum = pgEnum('delivery_attempt_outcome', [
  'sent',
  'retryable_failure',
  'permanent_failure',
  'not_configured',
  'recipient_unavailable',
]);
export const sessionClientEnum = pgEnum('session_client', ['web', 'mobile']);
export const priorityConflictStatusEnum = pgEnum('priority_conflict_status', ['open', 'resolved']);
export const documentFolderEnum = pgEnum('document_folder', DOCUMENT_FOLDERS);
export const reassignmentStatusEnum = pgEnum('reassignment_status', REASSIGNMENT_STATUSES);
export const dateChangeStatusEnum = pgEnum('date_change_status', DATE_CHANGE_STATUSES);
export const clientSignOffMethodEnum = pgEnum('client_sign_off_method', CLIENT_SIGN_OFF_METHODS);
export const projectCostCategoryEnum = pgEnum('project_cost_category', PROJECT_COST_CATEGORIES);
