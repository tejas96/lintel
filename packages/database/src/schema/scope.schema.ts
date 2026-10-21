import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId, updatedAt, version } from './columns';
import {
  clientSignOffMethodEnum,
  projectCostCategoryEnum,
  scopeChangeStatusEnum,
  taskPriorityEnum,
  taskStatusEnum,
} from './enums';
import { users } from './identity.schema';
import { projectStages, projects } from './projects.schema';
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
    /** Working days the proposal pushed the planned end, as assessed when it was proposed. */
    projectEndImpactDays: integer('project_end_impact_days').notNull().default(0),
    /** What the extra work costs the studio (minor units); recorded on the cost ledger on approval. */
    costImpactMinor: bigint('cost_impact_minor', { mode: 'number' }),
    costCategory: projectCostCategoryEnum('cost_category'),
    /** What the client pays more (or, negative, less); added to the budget on approval. */
    feeImpactMinor: bigint('fee_impact_minor', { mode: 'number' }),
    /** Approval waits until the client's sign-off is recorded. */
    requiresClientSignOff: boolean('requires_client_sign_off').notNull().default(false),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('scope_changes_project_idx').on(table.projectId, table.status),
    check(
      'scope_changes_cost_positive',
      sql`${table.costImpactMinor} IS NULL OR ${table.costImpactMinor} > 0`,
    ),
    check(
      'scope_changes_fee_not_zero',
      sql`${table.feeImpactMinor} IS NULL OR ${table.feeImpactMinor} <> 0`,
    ),
  ],
);

/**
 * How the client confirmed a scope change: who, when and how. Rows are never
 * changed; a correction adds a new row and the latest one counts.
 */
export const scopeChangeClientSignOffs = pgTable(
  'scope_change_client_sign_offs',
  {
    id: primaryId(),
    scopeChangeId: uuid('scope_change_id')
      .notNull()
      .references(() => scopeChangeRequests.id, { onDelete: 'cascade' }),
    confirmedByName: text('confirmed_by_name').notNull(),
    method: clientSignOffMethodEnum('method').notNull(),
    /** The day the client confirmed, in the business timezone. */
    confirmedOn: date('confirmed_on', { mode: 'string' }).notNull(),
    note: text('note'),
    recordedByUserId: uuid('recorded_by_user_id')
      .notNull()
      .references(() => users.id),
    recordedAt: instant('recorded_at').notNull().defaultNow(),
  },
  (table) => [index('scope_sign_offs_change_idx').on(table.scopeChangeId, table.recordedAt)],
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
    currentStartDate: date('current_start_date', { mode: 'string' }),
    proposedStartDate: date('proposed_start_date', { mode: 'string' }),
    shiftWorkingDays: integer('shift_working_days').notNull().default(0),
    isDownstream: boolean('is_downstream').notNull().default(false),
    /**
     * True when the change set exact dates (dragged on the timeline): approval
     * applies the proposed dates. Otherwise it shifts the task's current dates.
     */
    appliesExactDates: boolean('applies_exact_dates').notNull().default(false),
  },
  (table) => [index('scope_impacts_change_idx').on(table.scopeChangeId)],
);

/** A task the proposal adds. Created (and linked here) only when the change is approved. */
export const scopeChangeNewTasks = pgTable(
  'scope_change_new_tasks',
  {
    id: primaryId(),
    scopeChangeId: uuid('scope_change_id')
      .notNull()
      .references(() => scopeChangeRequests.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    title: text('title').notNull(),
    stageId: uuid('stage_id').references(() => projectStages.id, { onDelete: 'set null' }),
    plannedStartDate: date('planned_start_date', { mode: 'string' }),
    dueDate: date('due_date', { mode: 'string' }),
    ownerUserId: uuid('owner_user_id').references(() => users.id),
    priority: taskPriorityEnum('priority').notNull().default('medium'),
    createdTaskId: uuid('created_task_id').references(() => tasks.id, { onDelete: 'set null' }),
  },
  (table) => [index('scope_new_tasks_change_idx').on(table.scopeChangeId, table.position)],
);

/** A task the proposal cancels. Applied on approval unless the task has closed meanwhile. */
export const scopeChangeTaskCancellations = pgTable(
  'scope_change_task_cancellations',
  {
    id: primaryId(),
    scopeChangeId: uuid('scope_change_id')
      .notNull()
      .references(() => scopeChangeRequests.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    statusAtProposal: taskStatusEnum('status_at_proposal').notNull(),
    appliedAt: instant('applied_at'),
    /** Why approval left the task as it was (it closed or went to review meanwhile). */
    skipReason: text('skip_reason'),
  },
  (table) => [index('scope_cancellations_change_idx').on(table.scopeChangeId)],
);
