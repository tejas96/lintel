import type { MilestoneCheckResult } from '@lintel/domain';
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId, updatedAt, version } from './columns';
import { milestoneRewardStatusEnum, rewardRecommendationEnum, rewardScopeEnum } from './enums';
import { users } from './identity.schema';
import { milestones, projects } from './projects.schema';

/**
 * A reward attached to one milestone while planning, for one person or
 * shared by several. One row per milestone: withdrawing keeps the row (and
 * its audit trail); attaching again revives it.
 */
export const milestoneRewards = pgTable(
  'milestone_rewards',
  {
    id: primaryId(),
    milestoneId: uuid('milestone_id')
      .notNull()
      .references(() => milestones.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    scope: rewardScopeEnum('scope').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: text('currency').notNull().default('INR'),
    /** The milestone's due date when the reward was attached (or last changed). */
    agreedDueDate: date('agreed_due_date', { mode: 'string' }).notNull(),
    /** Project document folders that must hold a current document at completion. */
    requiredDocumentFolders: text('required_document_folders').array().notNull().default([]),
    note: text('note'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id),
    evaluatedAt: instant('evaluated_at'),
    withdrawnAt: instant('withdrawn_at'),
    withdrawnByUserId: uuid('withdrawn_by_user_id').references(() => users.id),
    withdrawReason: text('withdraw_reason'),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('milestone_rewards_milestone_unique').on(table.milestoneId),
    index('milestone_rewards_project_idx').on(table.projectId),
    check('milestone_rewards_amount_not_negative', sql`${table.amountMinor} >= 0`),
  ],
);

/** What the rules found for one recipient when the milestone was completed. */
export interface MilestoneRewardEvidence {
  readonly checks: readonly MilestoneCheckResult[];
  readonly agreedDueDate: string;
  readonly dueDate: string;
  readonly completedOn: string;
}

/**
 * One person's share of a milestone reward and its outcome: planned until
 * the milestone completes, then recommended and decided by a person.
 */
export const milestoneRewardRecipients = pgTable(
  'milestone_reward_recipients',
  {
    id: primaryId(),
    milestoneRewardId: uuid('milestone_reward_id')
      .notNull()
      .references(() => milestoneRewards.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    /** Order of the split (by name): the remainder goes to the first people. */
    position: integer('position').notNull().default(0),
    shareAmountMinor: bigint('share_amount_minor', { mode: 'number' }).notNull(),
    status: milestoneRewardStatusEnum('status').notNull().default('planned'),
    recommendation: rewardRecommendationEnum('recommendation'),
    summary: text('summary'),
    evidence: jsonb('evidence').$type<MilestoneRewardEvidence>(),
    adjustedAmountMinor: bigint('adjusted_amount_minor', { mode: 'number' }),
    adjustmentReason: text('adjustment_reason'),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: instant('decided_at'),
    decisionNote: text('decision_note'),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('milestone_reward_recipients_unique').on(table.milestoneRewardId, table.userId),
    index('milestone_reward_recipients_user_idx').on(table.userId, table.status),
    check('milestone_reward_recipients_share_not_negative', sql`${table.shareAmountMinor} >= 0`),
  ],
);
