import { PROJECT_COST_CATEGORIES } from '@lintel/domain';
import { sql } from 'drizzle-orm';
import { bigint, check, date, index, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId, updatedAt, version } from './columns';
import { users } from './identity.schema';
import { projects } from './projects.schema';

export const projectCostCategoryEnum = pgEnum('project_cost_category', PROJECT_COST_CATEGORIES);

/**
 * The project cost ledger. Entries are never edited or deleted: a mistake is
 * voided (with a reason, kept for the audit) and recorded again.
 */
export const projectCostEntries = pgTable(
  'project_cost_entries',
  {
    id: primaryId(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    /** The calendar date the cost was incurred, in the business timezone. */
    entryDate: date('entry_date', { mode: 'string' }).notNull(),
    category: projectCostCategoryEnum('category').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    note: text('note'),
    recordedByUserId: uuid('recorded_by_user_id')
      .notNull()
      .references(() => users.id),
    voidedAt: instant('voided_at'),
    voidedByUserId: uuid('voided_by_user_id').references(() => users.id),
    voidReason: text('void_reason'),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('project_cost_entries_project_idx').on(table.projectId, table.entryDate),
    check('project_cost_entries_amount_positive', sql`${table.amountMinor} > 0`),
  ],
);
