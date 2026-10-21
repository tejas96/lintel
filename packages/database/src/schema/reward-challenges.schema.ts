import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId, updatedAt, version } from './columns';
import { rewardChallengeStatusEnum } from './enums';
import { users } from './identity.schema';
import { milestoneRewardRecipients } from './milestone-rewards.schema';
import { rewardEvaluations } from './rewards.schema';

/** A reward record's outcome at one moment, kept with the challenge as history. */
export interface ChallengeRecordSnapshot {
  readonly status: string;
  readonly grantedAmountMinor: number | null;
  readonly decisionNote: string | null;
}

/**
 * A person disputing one reward record (a periodic evaluation, or their
 * share of a milestone reward). Exactly one of the two references is set.
 * One open challenge per record at a time; a reviewer upholds or corrects it.
 */
export const rewardChallenges = pgTable(
  'reward_challenges',
  {
    id: primaryId(),
    evaluationId: uuid('evaluation_id').references(() => rewardEvaluations.id, {
      onDelete: 'cascade',
    }),
    milestoneRecipientId: uuid('milestone_recipient_id').references(
      () => milestoneRewardRecipients.id,
      { onDelete: 'cascade' },
    ),
    raisedByUserId: uuid('raised_by_user_id')
      .notNull()
      .references(() => users.id),
    reason: text('reason').notNull(),
    status: rewardChallengeStatusEnum('status').notNull().default('open'),
    recordBefore: jsonb('record_before').$type<ChallengeRecordSnapshot>().notNull(),
    recordAfter: jsonb('record_after').$type<ChallengeRecordSnapshot>(),
    resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id),
    resolvedAt: instant('resolved_at'),
    resolutionNote: text('resolution_note'),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      'reward_challenges_one_record',
      sql`(${table.evaluationId} IS NULL) <> (${table.milestoneRecipientId} IS NULL)`,
    ),
    uniqueIndex('reward_challenges_open_evaluation')
      .on(table.evaluationId)
      .where(sql`${table.status} = 'open'`),
    uniqueIndex('reward_challenges_open_milestone')
      .on(table.milestoneRecipientId)
      .where(sql`${table.status} = 'open'`),
    index('reward_challenges_raised_by_idx').on(table.raisedByUserId, table.createdAt),
    index('reward_challenges_status_idx').on(table.status, table.createdAt),
  ],
);
