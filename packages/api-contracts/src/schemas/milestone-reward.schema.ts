import { MILESTONE_REWARD_STATUSES, REWARD_SCOPES } from '@lintel/domain';
import { z } from 'zod';
import {
  calendarDateSchema,
  idSchema,
  instantSchema,
  moneyMinorSchema,
  type ResponseSchema,
} from '../common/primitives';
import { documentFolderSchema } from './document.schema';
import { userSummarySchema } from './people.schema';
import { projectRefSchema } from './project.schema';
import { criterionResultSchema } from './reward.schema';
import { challengeabilitySchema, challengeEntrySchema } from './reward-challenge.schema';

export const milestoneRewardStatusSchema = z.enum(MILESTONE_REWARD_STATUSES);

/** A reward attached to a milestone, as planners see it in the project. */
export const milestoneRewardPlanObject = z.object({
  id: idSchema,
  milestoneId: idSchema,
  scope: z.enum(REWARD_SCOPES),
  amountMinor: moneyMinorSchema,
  currency: z.string(),
  agreedDueDate: calendarDateSchema,
  requiredDocumentFolders: z.array(documentFolderSchema),
  note: z.string().nullable(),
  /** planned until the milestone completes; checked once the rules ran; withdrawn when removed. */
  state: z.enum(['planned', 'checked', 'withdrawn']),
  evaluatedAt: instantSchema.nullable(),
  withdrawnAt: instantSchema.nullable(),
  withdrawReason: z.string().nullable(),
  /** In split order (by name). Each share is the equal split of the amount. */
  recipients: z.array(
    z.object({
      user: userSummarySchema,
      shareAmountMinor: moneyMinorSchema,
      status: milestoneRewardStatusSchema,
      recommendation: z.enum(['grant', 'withhold']).nullable(),
    }),
  ),
  /** The conditions in words: what earns this reward. */
  conditions: z.array(z.string()),
  version: z.number().int(),
});
export type MilestoneRewardPlan = z.infer<typeof milestoneRewardPlanObject>;
export const milestoneRewardPlanSchema: ResponseSchema<MilestoneRewardPlan> =
  milestoneRewardPlanObject;

/** One person's milestone reward: what earns it, the rules' findings, the decision. */
export const milestoneRewardShareObject = z.object({
  id: idSchema,
  planId: idSchema,
  project: projectRefSchema,
  milestone: z.object({
    id: idSchema,
    name: z.string(),
    dueDate: calendarDateSchema,
    status: z.enum(['pending', 'completed', 'cancelled']),
    completedAt: instantSchema.nullable(),
  }),
  scope: z.enum(REWARD_SCOPES),
  /** How many people share the reward (1 for an individual reward). */
  sharedBy: z.number().int(),
  agreedDueDate: calendarDateSchema,
  conditions: z.array(z.string()),
  note: z.string().nullable(),
  user: userSummarySchema.nullable(),
  status: milestoneRewardStatusSchema,
  recommendation: z.enum(['grant', 'withhold']).nullable(),
  summary: z.string().nullable(),
  /** The rules' findings at completion; empty while planned. */
  criteria: z.array(criterionResultSchema),
  /** Hidden (null) unless the viewer is this person or holds `rewards.view_all`. */
  totalAmountMinor: moneyMinorSchema.nullable(),
  shareAmountMinor: moneyMinorSchema.nullable(),
  adjustedAmountMinor: moneyMinorSchema.nullable(),
  adjustmentReason: z.string().nullable(),
  currency: z.string(),
  decidedBy: userSummarySchema.nullable(),
  decidedAt: instantSchema.nullable(),
  decisionNote: z.string().nullable(),
  challenges: z.array(challengeEntrySchema),
  challengeable: challengeabilitySchema,
  version: z.number().int(),
});
export type MilestoneRewardShare = z.infer<typeof milestoneRewardShareObject>;
export const milestoneRewardShareSchema: ResponseSchema<MilestoneRewardShare> =
  milestoneRewardShareObject;
