import { REWARD_EVALUATION_STATUSES, REWARD_PERIODS, REWARD_SCOPES } from '@lintel/domain';
import { z } from 'zod';
import {
  calendarDateSchema,
  idSchema,
  instantSchema,
  moneyMinorSchema,
  type ResponseSchema,
} from '../common/primitives';
import { userSummarySchema } from './people.schema';

const rate = z.number().min(0).max(1);
const count = z.number().int().min(0).max(1000);

export const rewardCriterionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('on_time_delivery_rate'), minimumRate: rate, minimumTasks: count }),
  z.object({
    type: z.literal('first_pass_approval_rate'),
    minimumRate: rate,
    minimumReviews: count,
  }),
  z.object({ type: z.literal('milestones_delivered_on_time'), minimumCount: count }),
  z.object({
    type: z.literal('proactive_blocker_reporting'),
    minimumCount: count,
    leadDays: count,
  }),
  z.object({ type: z.literal('collaboration'), minimumTasks: count }),
  z.object({ type: z.literal('process_compliance_rate'), minimumRate: rate, minimumTasks: count }),
  z.object({ type: z.literal('on_time_improvement'), minimumPercentagePoints: count }),
]);

export const rewardPolicyObject = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  scope: z.enum(REWARD_SCOPES),
  period: z.enum(REWARD_PERIODS),
  criteria: z.array(rewardCriterionSchema),
  amountMinor: moneyMinorSchema,
  currency: z.string(),
  isActive: z.boolean(),
  version: z.number().int(),
});
export type RewardPolicy = z.infer<typeof rewardPolicyObject>;
export const rewardPolicySchema: ResponseSchema<RewardPolicy> = rewardPolicyObject;

export const criterionResultSchema = z.object({
  type: z.string(),
  label: z.string(),
  passed: z.boolean(),
  actual: z.string(),
  required: z.string(),
  explanation: z.string(),
});

export const rewardEvaluationObject = z.object({
  id: idSchema,
  policy: z.object({ id: idSchema, name: z.string(), scope: z.enum(REWARD_SCOPES) }),
  user: userSummarySchema.nullable(),
  team: z.object({ id: idSchema, name: z.string() }).nullable(),
  periodStart: calendarDateSchema,
  periodEnd: calendarDateSchema,
  status: z.enum(REWARD_EVALUATION_STATUSES),
  summary: z.string(),
  criteria: z.array(criterionResultSchema),
  /** Hidden (null) unless the viewer may see this compensation detail. */
  amountMinor: moneyMinorSchema.nullable(),
  adjustedAmountMinor: moneyMinorSchema.nullable(),
  adjustmentReason: z.string().nullable(),
  currency: z.string(),
  decidedBy: userSummarySchema.nullable(),
  decidedAt: instantSchema.nullable(),
  decisionNote: z.string().nullable(),
  createdAt: instantSchema,
  version: z.number().int(),
});
export type RewardEvaluation = z.infer<typeof rewardEvaluationObject>;
export const rewardEvaluationSchema: ResponseSchema<RewardEvaluation> = rewardEvaluationObject;
