import { sql } from 'drizzle-orm';
import { check, date, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId, updatedAt, version } from './columns';
import { dateChangeStatusEnum } from './enums';
import { users } from './identity.schema';
import { projects } from './projects.schema';
import { tasks } from './tasks.schema';

/**
 * A task owner's (or collaborator's) request for new dates, decided by the
 * project manager. At most one open request per task; nobody decides their
 * own. Accepting moves the task and writes task_schedule_changes.
 */
export const taskDateChangeRequests = pgTable(
  'task_date_change_requests',
  {
    id: primaryId(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    requestedByUserId: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id),
    /** The task's dates when the request was made. */
    previousStartDate: date('previous_start_date', { mode: 'string' }),
    previousDueDate: date('previous_due_date', { mode: 'string' }),
    proposedStartDate: date('proposed_start_date', { mode: 'string' }),
    proposedDueDate: date('proposed_due_date', { mode: 'string' }).notNull(),
    reason: text('reason').notNull(),
    status: dateChangeStatusEnum('status').notNull().default('open'),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: instant('decided_at'),
    decisionNote: text('decision_note'),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('task_date_change_one_open_per_task')
      .on(table.taskId)
      .where(sql`${table.status} = 'open'`),
    index('task_date_change_project_idx').on(table.projectId, table.status),
    index('task_date_change_task_idx').on(table.taskId, table.createdAt),
    check(
      'task_date_change_not_self_decided',
      sql`${table.decidedByUserId} IS NULL OR ${table.decidedByUserId} <> ${table.requestedByUserId}`,
    ),
    check(
      'task_date_change_start_before_due',
      sql`${table.proposedStartDate} IS NULL OR ${table.proposedStartDate} <= ${table.proposedDueDate}`,
    ),
  ],
);
