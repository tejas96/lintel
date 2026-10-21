import { REWARD_CHALLENGE_STATUSES, REWARD_RECORD_KINDS } from '@lintel/domain';
import { z } from 'zod';
import {
  idSchema,
  instantSchema,
  moneyMinorSchema,
  type ResponseSchema,
} from '../common/primitives';
import { userSummarySchema } from './people.schema';

export const rewardRecordKindSchema = z.enum(REWARD_RECORD_KINDS);

/** A record's outcome at one moment. The amount is null unless the viewer may see it. */
export const challengeSnapshotSchema = z.object({
  status: z.string(),
  grantedAmountMinor: moneyMinorSchema.nullable(),
  decisionNote: z.string().nullable(),
});

/** One challenge in a record's history: the reason, and the reviewer's answer. */
export const challengeEntryObject = z.object({
  id: idSchema,
  status: z.enum(REWARD_CHALLENGE_STATUSES),
  reason: z.string(),
  raisedBy: userSummarySchema.nullable(),
  createdAt: instantSchema,
  before: challengeSnapshotSchema,
  after: challengeSnapshotSchema.nullable(),
  resolvedBy: userSummarySchema.nullable(),
  resolvedAt: instantSchema.nullable(),
  resolutionNote: z.string().nullable(),
  version: z.number().int(),
});
export type ChallengeEntry = z.infer<typeof challengeEntryObject>;
export const challengeEntrySchema: ResponseSchema<ChallengeEntry> = challengeEntryObject;

/** Whether the viewer may challenge the record now, and if not, why (in plain words). */
export const challengeabilitySchema = z.object({
  allowed: z.boolean(),
  reason: z.string().nullable(),
});

/** What a reviewer needs to judge a challenge, without opening the record. */
export const challengedRecordSchema = z.object({
  kind: rewardRecordKindSchema,
  id: idSchema,
  title: z.string(),
  subjectName: z.string(),
  status: z.string(),
  summary: z.string().nullable(),
  criteria: z.array(
    z.object({
      type: z.string(),
      label: z.string(),
      passed: z.boolean(),
      actual: z.string(),
      required: z.string(),
      explanation: z.string(),
    }),
  ),
  /** What the rules or policy proposed; null unless the viewer may see amounts. */
  proposedAmountMinor: moneyMinorSchema.nullable(),
  currency: z.string(),
});

export const rewardChallengeObject = challengeEntryObject.extend({
  record: challengedRecordSchema,
});
export type RewardChallenge = z.infer<typeof rewardChallengeObject>;
export const rewardChallengeSchema: ResponseSchema<RewardChallenge> = rewardChallengeObject;
