import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId, updatedAt, version } from './columns';
import { reassignmentStatusEnum } from './enums';
import { users } from './identity.schema';
import { projects } from './projects.schema';
import { tasks } from './tasks.schema';

/**
 * A task owner's (or collaborator's) request that the project manager hand
 * the task to someone else. At most one open request per task; decisions are
 * never made by the person who asked.
 */
export const taskReassignmentRequests = pgTable(
  'task_reassignment_requests',
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
    /** Who owned the task when the request was made. */
    ownerAtRequestUserId: uuid('owner_at_request_user_id').references(() => users.id),
    suggestedUserId: uuid('suggested_user_id').references(() => users.id),
    reason: text('reason').notNull(),
    status: reassignmentStatusEnum('status').notNull().default('open'),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: instant('decided_at'),
    decisionNote: text('decision_note'),
    /** The owner the manager chose when accepting. */
    newOwnerUserId: uuid('new_owner_user_id').references(() => users.id),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('task_reassignment_one_open_per_task')
      .on(table.taskId)
      .where(sql`${table.status} = 'open'`),
    index('task_reassignment_project_idx').on(table.projectId, table.status),
    index('task_reassignment_task_idx').on(table.taskId, table.createdAt),
    check(
      'task_reassignment_not_self_decided',
      sql`${table.decidedByUserId} IS NULL OR ${table.decidedByUserId} <> ${table.requestedByUserId}`,
    ),
  ],
);
