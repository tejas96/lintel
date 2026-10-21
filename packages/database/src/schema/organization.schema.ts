import { sql } from 'drizzle-orm';
import { boolean, check, date, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt, primaryId, updatedAt, version } from './columns';

/** One row: this deployment serves a single studio (see docs/DECISIONS/0003). */
export const organizationSettings = pgTable(
  'organization_settings',
  {
    id: integer('id').primaryKey().default(1),
    name: text('name').notNull(),
    timeZone: text('time_zone').notNull().default('Asia/Kolkata'),
    currency: text('currency').notNull().default('INR'),
    projectReferencePrefix: text('project_reference_prefix').notNull().default('PRJ'),
    deadlineReminderTime: text('deadline_reminder_time').notNull().default('10:00'),
    defaultQuietHoursStart: text('default_quiet_hours_start').notNull().default('21:00'),
    defaultQuietHoursEnd: text('default_quiet_hours_end').notNull().default('08:00'),
    leaveSecondApprovalAboveHalfDays: integer('leave_second_approval_above_half_days')
      .notNull()
      .default(10),
    workTrackingEnabled: boolean('work_tracking_enabled').notNull().default(true),
    /** Budget against recorded cost, for people allowed to see project finances. Off by default. */
    profitabilityEnabled: boolean('profitability_enabled').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [check('organization_settings_single_row', sql`${table.id} = 1`)],
);

export const workingCalendars = pgTable('working_calendars', {
  id: primaryId(),
  name: text('name').notNull(),
  timeZone: text('time_zone').notNull(),
  workingWeekdays: integer('working_weekdays').array().notNull(),
  dayStartTime: text('day_start_time').notNull(),
  dayEndTime: text('day_end_time').notNull(),
  workingMinutesPerDay: integer('working_minutes_per_day').notNull(),
  /** The studio week. People without a calendar of their own follow it. */
  isDefault: boolean('is_default').notNull().default(false),
  version: version(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const calendarHolidays = pgTable(
  'calendar_holidays',
  {
    id: primaryId(),
    calendarId: uuid('calendar_id')
      .notNull()
      .references(() => workingCalendars.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    name: text('name').notNull(),
    createdAt: createdAt(),
  },
  (table) => [unique('calendar_holidays_unique_date').on(table.calendarId, table.date)],
);

export const teams = pgTable('teams', {
  id: primaryId(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
