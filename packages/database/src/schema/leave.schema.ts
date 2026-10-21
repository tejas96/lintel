import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId, updatedAt, version } from './columns';
import {
  approvalStepStatusEnum,
  dayPortionEnum,
  handoverStatusEnum,
  leaveStatusEnum,
} from './enums';
import { users } from './identity.schema';
import { tasks } from './tasks.schema';

/** Leave types and their rules are configured by each studio; nothing statutory is assumed. */
export const leaveTypes = pgTable('leave_types', {
  id: primaryId(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  requiresReason: boolean('requires_reason').notNull().default(false),
  allowsHalfDay: boolean('allows_half_day').notNull().default(true),
  minimumNoticeDays: integer('minimum_notice_days').notNull().default(0),
  annualAllowanceHalfDays: integer('annual_allowance_half_days'),
  colorIndex: integer('color_index').notNull().default(0),
  /** Retired types stay on existing requests but cannot be chosen for new ones. */
  isActive: boolean('is_active').notNull().default(true),
  version: version(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export interface LeaveConflictSnapshot {
  readonly capturedAt: string;
  readonly hasCritical: boolean;
  readonly taskConflicts: readonly {
    taskId: string;
    title: string;
    severity: string;
    explanation: string;
  }[];
}

export const leaveRequests = pgTable(
  'leave_requests',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    leaveTypeId: uuid('leave_type_id')
      .notNull()
      .references(() => leaveTypes.id),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    dayPortion: dayPortionEnum('day_portion').notNull().default('full'),
    halfDayUnits: integer('half_day_units').notNull(),
    reason: text('reason'),
    status: leaveStatusEnum('status').notNull().default('pending'),
    isUrgentAbsence: boolean('is_urgent_absence').notNull().default(false),
    recordedByUserId: uuid('recorded_by_user_id').references(() => users.id),
    warnings: text('warnings').array().notNull().default([]),
    conflictSnapshot: jsonb('conflict_snapshot').$type<LeaveConflictSnapshot>(),
    decisionNote: text('decision_note'),
    decidedAt: instant('decided_at'),
    cancelledAt: instant('cancelled_at'),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('leave_requests_user_idx').on(table.userId, table.startDate),
    index('leave_requests_status_idx').on(table.status, table.startDate),
    check('leave_requests_dates_ordered', sql`${table.endDate} >= ${table.startDate}`),
  ],
);

/** Level 1 is the person's manager; level 2 (when required) is the owner or an administrator. */
export const leaveApprovalSteps = pgTable(
  'leave_approval_steps',
  {
    id: primaryId(),
    leaveRequestId: uuid('leave_request_id')
      .notNull()
      .references(() => leaveRequests.id, { onDelete: 'cascade' }),
    level: integer('level').notNull(),
    approverUserId: uuid('approver_user_id').references(() => users.id),
    status: approvalStepStatusEnum('status').notNull().default('pending'),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: instant('decided_at'),
    note: text('note'),
  },
  (table) => [
    unique('leave_steps_level_unique').on(table.leaveRequestId, table.level),
    index('leave_steps_approver_idx').on(table.approverUserId, table.status),
  ],
);

export const leaveHandovers = pgTable(
  'leave_handovers',
  {
    id: primaryId(),
    leaveRequestId: uuid('leave_request_id')
      .notNull()
      .references(() => leaveRequests.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    toUserId: uuid('to_user_id').references(() => users.id),
    note: text('note'),
    status: handoverStatusEnum('status').notNull().default('proposed'),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: instant('decided_at'),
    createdAt: createdAt(),
  },
  (table) => [unique('leave_handovers_task_unique').on(table.leaveRequestId, table.taskId)],
);
