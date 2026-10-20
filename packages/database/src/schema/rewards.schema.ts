import type { CriterionResult, RewardCriterion } from '@lintel/domain';
import {
  bigint,
  boolean,
  date,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId, updatedAt, version } from './columns';
import { rewardEvaluationStatusEnum, rewardPeriodEnum, rewardScopeEnum } from './enums';
import { users } from './identity.schema';
import { teams } from './organization.schema';

export const rewardPolicies = pgTable('reward_policies', {
  id: primaryId(),
  name: text('name').notNull(),
  description: text('description'),
  scope: rewardScopeEnum('scope').notNull(),
  period: rewardPeriodEnum('period').notNull(),
  criteria: jsonb('criteria').$type<readonly RewardCriterion[]>().notNull(),
  amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
  currency: text('currency').notNull().default('INR'),
  isActive: boolean('is_active').notNull().default(true),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  version: version(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export interface RewardEvidence {
  readonly criteria: readonly CriterionResult[];
  readonly metrics: Readonly<Record<string, number | null>>;
  readonly policyVersion: number;
}

/**
 * One evaluation per policy, subject and period. The unique index makes
 * re-running an evaluation idempotent and prevents duplicate rewards.
 */
export const rewardEvaluations = pgTable(
  'reward_evaluations',
  {
    id: primaryId(),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => rewardPolicies.id),
    subjectKey: text('subject_key').notNull(),
    userId: uuid('user_id').references(() => users.id),
    teamId: uuid('team_id').references(() => teams.id),
    periodStart: date('period_start', { mode: 'string' }).notNull(),
    periodEnd: date('period_end', { mode: 'string' }).notNull(),
    status: rewardEvaluationStatusEnum('status').notNull(),
    summary: text('summary').notNull(),
    evidence: jsonb('evidence').$type<RewardEvidence>().notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
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
    uniqueIndex('reward_evaluations_unique_period').on(
      table.policyId,
      table.subjectKey,
      table.periodStart,
    ),
    index('reward_evaluations_user_idx').on(table.userId, table.periodStart),
  ],
);
