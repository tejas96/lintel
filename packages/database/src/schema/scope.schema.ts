import { boolean, date, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId, updatedAt, version } from './columns';
import { scopeChangeStatusEnum } from './enums';
import { users } from './identity.schema';
import { projects } from './projects.schema';
import { tasks } from './tasks.schema';

export const scopeChangeRequests = pgTable(
  'scope_change_requests',
  {
    id: primaryId(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    status: scopeChangeStatusEnum('status').notNull().default('proposed'),
    requestedByUserId: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: instant('decided_at'),
    decisionNote: text('decision_note'),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('scope_changes_project_idx').on(table.projectId, table.status)],
);

/** The proposed date change for each affected task, applied only on approval. */
export const scopeChangeTaskImpacts = pgTable(
  'scope_change_task_impacts',
  {
    id: primaryId(),
    scopeChangeId: uuid('scope_change_id')
      .notNull()
      .references(() => scopeChangeRequests.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    currentDueDate: date('current_due_date', { mode: 'string' }),
    proposedDueDate: date('proposed_due_date', { mode: 'string' }),
    shiftWorkingDays: integer('shift_working_days').notNull().default(0),
    isDownstream: boolean('is_downstream').notNull().default(false),
  },
  (table) => [index('scope_impacts_change_idx').on(table.scopeChangeId)],
);
