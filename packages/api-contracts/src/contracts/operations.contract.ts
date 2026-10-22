import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { pageQuerySchema, pageSchema } from '../common/pagination';
import {
  calendarDateSchema,
  emptyBodySchema,
  idSchema,
  instantSchema,
  noteSchema,
  queryBooleanSchema,
  shortTextSchema,
  versionSchema,
} from '../common/primitives';
import { capacityOverviewSchema } from '../schemas/capacity.schema';
import { commandCenterSchema } from '../schemas/dashboard.schema';
import {
  deviceSchema,
  notificationPreferencesInputSchema,
  notificationPreferencesSchema,
  notificationSchema,
  pushTokenTypeSchema,
} from '../schemas/notification.schema';
import { userSummarySchema } from '../schemas/people.schema';
import {
  rewardCriterionSchema,
  rewardEvaluationSchema,
  rewardPolicySchema,
} from '../schemas/reward.schema';

const c = initContract();

const idParams = z.object({ id: idSchema });

const policyInput = z.object({
  name: shortTextSchema,
  description: z.string().max(1000).nullable(),
  scope: z.enum(['individual', 'team']),
  period: z.enum(['monthly', 'quarterly']),
  criteria: z.array(rewardCriterionSchema).min(1).max(10),
  amountMinor: z.number().int().min(0).max(100_000_000),
  isActive: z.boolean(),
});

export const operationsContract = c.router({
  commandCenter: {
    method: 'GET',
    path: '/dashboard/command-center',
    query: z.object({
      from: calendarDateSchema.optional(),
      to: calendarDateSchema.optional(),
      projectId: idSchema.optional(),
      managerUserId: idSchema.optional(),
      teamId: idSchema.optional(),
    }),
    responses: { 200: commandCenterSchema },
    summary: 'Business-wide health computed from live records. Every number links to its source.',
  },
  capacity: {
    method: 'GET',
    path: '/capacity',
    query: z.object({
      from: calendarDateSchema,
      to: calendarDateSchema,
      teamId: idSchema.optional(),
    }),
    responses: { 200: capacityOverviewSchema },
  },
  listNotifications: {
    method: 'GET',
    path: '/notifications',
    query: pageQuerySchema.extend({ unreadOnly: queryBooleanSchema.default(false) }),
    responses: { 200: pageSchema(notificationSchema).extend({ unreadCount: z.number().int() }) },
  },
  markNotificationRead: {
    method: 'POST',
    path: '/notifications/:id/read',
    pathParams: idParams,
    body: emptyBodySchema,
    responses: { 204: c.noBody() },
  },
  markAllNotificationsRead: {
    method: 'POST',
    path: '/notifications/read-all',
    body: emptyBodySchema,
    responses: { 204: c.noBody() },
  },
  getNotificationPreferences: {
    method: 'GET',
    path: '/notifications/preferences',
    responses: { 200: notificationPreferencesSchema },
  },
  updateNotificationPreferences: {
    method: 'PUT',
    path: '/notifications/preferences',
    body: notificationPreferencesInputSchema,
    responses: { 200: notificationPreferencesSchema },
  },
  registerDevice: {
    method: 'POST',
    path: '/devices',
    body: z.object({
      platform: z.enum(['ios', 'android', 'web']),
      tokenType: pushTokenTypeSchema,
      token: z.string().min(20).max(4096),
      appVersion: z.string().max(40).nullable(),
    }),
    responses: { 200: deviceSchema },
    summary: 'Register or refresh a push token for the signed-in person.',
  },
  unregisterDevice: {
    method: 'DELETE',
    path: '/devices/:id',
    pathParams: idParams,
    body: c.noBody(),
    responses: { 204: c.noBody() },
  },
  listRewardPolicies: {
    method: 'GET',
    path: '/rewards/policies',
    responses: { 200: z.array(rewardPolicySchema) },
  },
  createRewardPolicy: {
    method: 'POST',
    path: '/rewards/policies',
    body: policyInput,
    responses: { 201: rewardPolicySchema },
  },
  updateRewardPolicy: {
    method: 'PUT',
    path: '/rewards/policies/:id',
    pathParams: idParams,
    body: policyInput.extend({ version: versionSchema }),
    responses: { 200: rewardPolicySchema },
  },
  listRewardEvaluations: {
    method: 'GET',
    path: '/rewards/evaluations',
    query: pageQuerySchema.extend({
      scope: z.enum(['mine', 'all']).default('mine'),
      status: z.enum(['ineligible', 'pending_review', 'approved', 'rejected']).optional(),
    }),
    responses: { 200: pageSchema(rewardEvaluationSchema) },
  },
  runRewardEvaluation: {
    method: 'POST',
    path: '/rewards/policies/:id/evaluate',
    pathParams: idParams,
    body: z.object({ periodStart: calendarDateSchema }),
    responses: { 200: z.object({ evaluated: z.number().int(), eligible: z.number().int() }) },
    summary: 'Evaluate a period now. Safe to repeat: one evaluation per person, policy and period.',
  },
  decideRewardEvaluation: {
    method: 'POST',
    path: '/rewards/evaluations/:id/decision',
    pathParams: idParams,
    body: z.object({
      decision: z.enum(['approve', 'reject']),
      note: noteSchema,
      adjustedAmountMinor: z.number().int().min(0).nullable(),
      version: versionSchema,
    }),
    responses: { 200: rewardEvaluationSchema },
  },
  listAuditLog: {
    method: 'GET',
    path: '/audit',
    query: pageQuerySchema.extend({
      entityType: z.string().max(60).optional(),
      actorUserId: idSchema.optional(),
    }),
    responses: {
      200: pageSchema(
        z.object({
          id: idSchema,
          actor: userSummarySchema.nullable(),
          action: z.string(),
          entityType: z.string(),
          entityId: z.string().nullable(),
          before: z.record(z.unknown()).nullable(),
          after: z.record(z.unknown()).nullable(),
          names: z.record(z.string()),
          createdAt: instantSchema,
        }),
      ),
    },
  },
});
