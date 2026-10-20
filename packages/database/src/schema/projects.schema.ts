import {
  bigint,
  boolean,
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
  milestoneStatusEnum,
  projectCriticalityEnum,
  projectRoleEnum,
  projectStatusEnum,
  projectTypeEnum,
  stageStatusEnum,
} from './enums';
import { users } from './identity.schema';
import { workflowTemplateVersions } from './templates.schema';

export const projects = pgTable(
  'projects',
  {
    id: primaryId(),
    reference: text('reference').notNull(),
    name: text('name').notNull(),
    clientName: text('client_name').notNull(),
    clientPhone: text('client_phone'),
    clientEmail: text('client_email'),
    siteAddress: text('site_address'),
    projectType: projectTypeEnum('project_type').notNull(),
    description: text('description'),
    status: projectStatusEnum('status').notNull().default('active'),
    criticality: projectCriticalityEnum('criticality').notNull().default('normal'),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id),
    managerUserId: uuid('manager_user_id')
      .notNull()
      .references(() => users.id),
    templateVersionId: uuid('template_version_id').references(() => workflowTemplateVersions.id),
    templateOptions: text('template_options').array().notNull().default([]),
    plannedStartDate: date('planned_start_date', { mode: 'string' }).notNull(),
    plannedEndDate: date('planned_end_date', { mode: 'string' }).notNull(),
    /** The first committed delivery date; never overwritten so slippage stays visible. */
    baselineEndDate: date('baseline_end_date', { mode: 'string' }).notNull(),
    actualEndDate: date('actual_end_date', { mode: 'string' }),
    budgetMinor: bigint('budget_minor', { mode: 'number' }),
    colorIndex: integer('color_index').notNull().default(0),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    archivedAt: instant('archived_at'),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('projects_reference_unique').on(table.reference),
    index('projects_status_idx').on(table.status),
    index('projects_manager_idx').on(table.managerUserId),
  ],
);

export const projectMembers = pgTable(
  'project_members',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectRole: projectRoleEnum('project_role').notNull(),
    addedAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId] }),
    index('project_members_user_idx').on(table.userId),
  ],
);

export const projectStages = pgTable(
  'project_stages',
  {
    id: primaryId(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    templateKey: text('template_key'),
    name: text('name').notNull(),
    description: text('description'),
    position: integer('position').notNull(),
    status: stageStatusEnum('status').notNull().default('pending'),
    plannedStartDate: date('planned_start_date', { mode: 'string' }),
    plannedEndDate: date('planned_end_date', { mode: 'string' }),
    startedAt: instant('started_at'),
    completedAt: instant('completed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('project_stages_project_idx').on(table.projectId, table.position)],
);

export const milestones = pgTable(
  'milestones',
  {
    id: primaryId(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    stageId: uuid('stage_id').references(() => projectStages.id, { onDelete: 'set null' }),
    templateKey: text('template_key'),
    name: text('name').notNull(),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    baselineDueDate: date('baseline_due_date', { mode: 'string' }).notNull(),
    status: milestoneStatusEnum('status').notNull().default('pending'),
    requiresClientApproval: boolean('requires_client_approval').notNull().default(false),
    completedAt: instant('completed_at'),
    completedByUserId: uuid('completed_by_user_id').references(() => users.id),
    position: integer('position').notNull().default(0),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('milestones_project_idx').on(table.projectId, table.dueDate)],
);
