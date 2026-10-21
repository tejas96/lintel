import { MAX_REWARD_AMOUNT_MINOR, MAX_SHARED_REWARD_RECIPIENTS } from '@lintel/domain';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { pageQuerySchema, pageSchema } from '../common/pagination';
import { idSchema, noteSchema, versionSchema } from '../common/primitives';
import { documentFolderSchema } from '../schemas/document.schema';
import {
  milestoneRewardPlanSchema,
  milestoneRewardShareSchema,
  milestoneRewardStatusSchema,
} from '../schemas/milestone-reward.schema';
import { rewardChallengeSchema, rewardRecordKindSchema } from '../schemas/reward-challenge.schema';

const c = initContract();
const idParams = z.object({ id: idSchema });
const amount = z.number().int().min(0).max(MAX_REWARD_AMOUNT_MINOR);

const amounts =
  ' Amounts are visible to the person and to holders of `rewards.view_all`; planners also see the amount they attached.';

/** Milestone rewards (plan, check, decision) and challenges of reward records. */
export const rewardRecordsContract = c.router({
  listProjectMilestoneRewards: {
    method: 'GET',
    path: '/projects/:id/milestone-rewards',
    pathParams: idParams,
    responses: { 200: z.array(milestoneRewardPlanSchema) },
    summary: `Rewards attached to the project's milestones. For \`rewards.manage_policies\`, \`rewards.decide\` or \`rewards.view_all\`.${amounts}`,
  },
  saveMilestoneReward: {
    method: 'PUT',
    path: '/milestones/:id/reward',
    pathParams: idParams,
    body: z.object({
      scope: z.enum(['individual', 'team']),
      recipientUserIds: z.array(idSchema).min(1).max(MAX_SHARED_REWARD_RECIPIENTS),
      amountMinor: amount,
      requiredDocumentFolders: z.array(documentFolderSchema).max(5),
      note: z.string().trim().max(500).nullable(),
      /** The plan's version when changing or re-attaching it; null for a first attach. */
      version: versionSchema.nullable(),
    }),
    responses: { 200: milestoneRewardPlanSchema },
    summary:
      'Attach or change the reward of an open milestone (`rewards.manage_policies`). A shared reward is split equally.',
  },
  withdrawMilestoneReward: {
    method: 'POST',
    path: '/milestones/:id/reward/withdraw',
    pathParams: idParams,
    body: z.object({ version: versionSchema, reason: noteSchema }),
    responses: { 200: milestoneRewardPlanSchema },
    summary: 'Withdraw a milestone reward before the milestone completes, with a reason.',
  },
  listMilestoneRewards: {
    method: 'GET',
    path: '/rewards/milestones',
    query: pageQuerySchema.extend({
      scope: z.enum(['mine', 'all']).default('mine'),
      status: milestoneRewardStatusSchema.optional(),
    }),
    responses: { 200: pageSchema(milestoneRewardShareSchema) },
    summary: `My milestone rewards, or everyone's for \`rewards.view_all\` / \`rewards.decide\`.${amounts}`,
  },
  decideMilestoneReward: {
    method: 'POST',
    path: '/rewards/milestones/:id/decision',
    pathParams: idParams,
    body: z.object({
      decision: z.enum(['approve', 'reject']),
      note: noteSchema,
      adjustedAmountMinor: amount.nullable(),
      version: versionSchema,
    }),
    responses: { 200: milestoneRewardShareSchema },
    summary: 'Approve or decline one person’s milestone reward (`rewards.decide`, never your own).',
  },
  listRewardChallenges: {
    method: 'GET',
    path: '/rewards/challenges',
    query: pageQuerySchema.extend({
      scope: z.enum(['mine', 'review']).default('mine'),
      status: z.enum(['open', 'resolved']).optional(),
    }),
    responses: { 200: pageSchema(rewardChallengeSchema) },
    summary: 'Challenges I raised, or (`rewards.decide`) the ones to answer.',
  },
  raiseRewardChallenge: {
    method: 'POST',
    path: '/rewards/challenges',
    body: z.object({
      recordKind: rewardRecordKindSchema,
      recordId: idSchema,
      reason: z.string().trim().min(10, 'Explain what is wrong, in a sentence or two.').max(2000),
    }),
    responses: { 201: rewardChallengeSchema },
    summary: 'Challenge a reward record about you, with a reason. One open challenge per record.',
  },
  resolveRewardChallenge: {
    method: 'POST',
    path: '/rewards/challenges/:id/resolution',
    pathParams: idParams,
    body: z.object({
      outcome: z.enum(['uphold', 'correct']),
      note: noteSchema,
      correctedAmountMinor: amount.nullable(),
      version: versionSchema,
    }),
    responses: { 200: rewardChallengeSchema },
    summary:
      'Uphold the record or correct it (grant, or raise the amount) with a note (`rewards.decide`).',
  },
});
