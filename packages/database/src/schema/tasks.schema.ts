import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId, updatedAt, version } from './columns';
import {
  blockerCategoryEnum,
  priorityConflictStatusEnum,
  taskPriorityEnum,
  taskStatusEnum,
} from './enums';
import { users } from './identity.schema';
import { milestones, projectStages, projects } from './projects.schema';

export const tasks = pgTable(
  'tasks',
  {
    id: primaryId(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    stageId: uuid('stage_id').references(() => projectStages.id, { onDelete: 'set null' }),
    milestoneId: uuid('milestone_id').references(() => milestones.id, { onDelete: 'set null' }),
    parentTaskId: uuid('parent_task_id').references((): AnyPgColumn => tasks.id, {
      onDelete: 'cascade',
    }),
    /** Per-project sequence number shown as "PRJ-014 · #23". */
    number: integer('number').notNull(),
    templateKey: text('template_key'),
    title: text('title').notNull(),
    description: text('description'),
    status: taskStatusEnum('status').notNull().default('draft'),
    priority: taskPriorityEnum('priority').notNull().default('medium'),
    ownerUserId: uuid('owner_user_id').references(() => users.id),
    reviewerUserId: uuid('reviewer_user_id').references(() => users.id),
    plannedStartDate: date('planned_start_date', { mode: 'string' }),
    dueDate: date('due_date', { mode: 'string' }),
    /** Optional time of day the task is due ("HH:mm", business timezone); null = end of the working day. */
    dueTime: text('due_time'),
    /** The first committed due date. Changes are recorded in task_schedule_changes. */
    baselineDueDate: date('baseline_due_date', { mode: 'string' }),
    estimateMinutes: integer('estimate_minutes'),
    actualMinutes: integer('actual_minutes').notNull().default(0),
    requiresReview: boolean('requires_review').notNull().default(false),
    requiresAcknowledgement: boolean('requires_acknowledgement').notNull().default(true),
    acknowledgedAt: instant('acknowledged_at'),
    completionCriteria: text('completion_criteria'),
    escalateAfterOverdueDays: integer('escalate_after_overdue_days').notNull().default(1),
    reviewRounds: integer('review_rounds').notNull().default(0),
    position: integer('position').notNull().default(0),
    startedAt: instant('started_at'),
    submittedAt: instant('submitted_at'),
    completedAt: instant('completed_at'),
    completedByUserId: uuid('completed_by_user_id').references(() => users.id),
    cancelledReason: text('cancelled_reason'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    archivedAt: instant('archived_at'),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('tasks_project_number_unique').on(table.projectId, table.number),
    index('tasks_owner_status_idx').on(table.ownerUserId, table.status),
    index('tasks_project_status_idx').on(table.projectId, table.status),
    index('tasks_due_idx').on(table.dueDate),
    index('tasks_parent_idx').on(table.parentTaskId),
    check(
      'tasks_estimate_not_negative',
      sql`${table.estimateMinutes} IS NULL OR ${table.estimateMinutes} >= 0`,
    ),
    check(
      'tasks_due_time_format',
      sql`${table.dueTime} IS NULL OR (${table.dueDate} IS NOT NULL AND ${table.dueTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')`,
    ),
  ],
);

export const taskDependencies = pgTable(
  'task_dependencies',
  {
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    dependsOnTaskId: uuid('depends_on_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.dependsOnTaskId] }),
    index('task_dependencies_reverse_idx').on(table.dependsOnTaskId),
    check('task_dependencies_not_self', sql`${table.taskId} <> ${table.dependsOnTaskId}`),
  ],
);

export const taskCollaborators = pgTable(
  'task_collaborators',
  {
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addedAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.userId] }),
    index('task_collaborators_user_idx').on(table.userId),
  ],
);

export const taskChecklistItems = pgTable(
  'task_checklist_items',
  {
    id: primaryId(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    isRequired: boolean('is_required').notNull().default(true),
    position: integer('position').notNull().default(0),
    completedAt: instant('completed_at'),
    completedByUserId: uuid('completed_by_user_id').references(() => users.id),
    createdAt: createdAt(),
  },
  (table) => [index('task_checklist_task_idx').on(table.taskId, table.position)],
);

export const taskComments = pgTable(
  'task_comments',
  {
    id: primaryId(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    editedAt: instant('edited_at'),
    createdAt: createdAt(),
  },
  (table) => [index('task_comments_task_idx').on(table.taskId, table.createdAt)],
);

/** Every period a task was blocked, why, and who resolved it. */
export const taskBlockers = pgTable(
  'task_blockers',
  {
    id: primaryId(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    category: blockerCategoryEnum('category').notNull(),
    reason: text('reason').notNull(),
    waitingOnUserId: uuid('waiting_on_user_id').references(() => users.id),
    raisedByUserId: uuid('raised_by_user_id')
      .notNull()
      .references(() => users.id),
    raisedAt: createdAt(),
    resolvedAt: instant('resolved_at'),
    resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id),
    resolution: text('resolution'),
  },
  (table) => [index('task_blockers_task_idx').on(table.taskId, table.resolvedAt)],
);

/** Due-date history: the original and every revised commitment, with the reason. */
export const taskScheduleChanges = pgTable(
  'task_schedule_changes',
  {
    id: primaryId(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    previousDueDate: date('previous_due_date', { mode: 'string' }),
    newDueDate: date('new_due_date', { mode: 'string' }),
    /** The due times around the change ("HH:mm"); null = end of the working day. */
    previousDueTime: text('previous_due_time'),
    newDueTime: text('new_due_time'),
    reason: text('reason').notNull(),
    isApproved: boolean('is_approved').notNull().default(true),
    scopeChangeId: uuid('scope_change_id'),
    /** Set when an accepted new-date request moved the task. */
    dateChangeRequestId: uuid('date_change_request_id'),
    changedByUserId: uuid('changed_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (table) => [index('task_schedule_changes_task_idx').on(table.taskId, table.createdAt)],
);

export const workSessions = pgTable(
  'work_sessions',
  {
    id: primaryId(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    startedAt: instant('started_at').notNull().defaultNow(),
    endedAt: instant('ended_at'),
  },
  (table) => [index('work_sessions_user_idx').on(table.userId, table.endedAt)],
);

export const priorityConflicts = pgTable('priority_conflicts', {
  id: primaryId(),
  raisedByUserId: uuid('raised_by_user_id')
    .notNull()
    .references(() => users.id),
  taskIds: uuid('task_ids').array().notNull(),
  note: text('note').notNull(),
  status: priorityConflictStatusEnum('status').notNull().default('open'),
  resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id),
  resolution: text('resolution'),
  resolvedAt: instant('resolved_at'),
  createdAt: createdAt(),
});
