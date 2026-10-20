import { bigint, boolean, index, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId, updatedAt, version } from './columns';
import {
  deliverableStatusEnum,
  fileStatusEnum,
  fileVisibilityEnum,
  reviewDecisionEnum,
} from './enums';
import { users } from './identity.schema';
import { projects } from './projects.schema';
import { tasks } from './tasks.schema';

/** Metadata for an object in RustFS. The bytes never live in PostgreSQL. */
export const files = pgTable(
  'files',
  {
    id: primaryId(),
    storageKey: text('storage_key').notNull().unique(),
    originalName: text('original_name').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    checksumSha256: text('checksum_sha256').notNull(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    visibility: fileVisibilityEnum('visibility').notNull().default('project'),
    status: fileStatusEnum('status').notNull().default('available'),
    uploadedByUserId: uuid('uploaded_by_user_id')
      .notNull()
      .references(() => users.id),
    deletedAt: instant('deleted_at'),
    createdAt: createdAt(),
  },
  (table) => [index('files_project_idx').on(table.projectId)],
);

export const taskAttachments = pgTable(
  'task_attachments',
  {
    id: primaryId(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id),
    createdAt: createdAt(),
  },
  (table) => [unique('task_attachments_unique').on(table.taskId, table.fileId)],
);

export const deliverables = pgTable(
  'deliverables',
  {
    id: primaryId(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    isRequired: boolean('is_required').notNull().default(true),
    status: deliverableStatusEnum('status').notNull().default('not_submitted'),
    reviewerUserId: uuid('reviewer_user_id').references(() => users.id),
    currentVersionNumber: integer('current_version_number').notNull().default(0),
    approvedAt: instant('approved_at'),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('deliverables_project_idx').on(table.projectId, table.status),
    index('deliverables_task_idx').on(table.taskId),
    index('deliverables_reviewer_idx').on(table.reviewerUserId, table.status),
  ],
);

/** Every submission is kept; reviews attach to a specific version. */
export const deliverableVersions = pgTable(
  'deliverable_versions',
  {
    id: primaryId(),
    deliverableId: uuid('deliverable_id')
      .notNull()
      .references(() => deliverables.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id),
    note: text('note'),
    submittedByUserId: uuid('submitted_by_user_id')
      .notNull()
      .references(() => users.id),
    submittedAt: createdAt(),
    decision: reviewDecisionEnum('decision').notNull().default('pending'),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id),
    reviewedAt: instant('reviewed_at'),
    reviewComment: text('review_comment'),
  },
  (table) => [unique('deliverable_versions_unique').on(table.deliverableId, table.versionNumber)],
);

export const siteUpdates = pgTable(
  'site_updates',
  {
    id: primaryId(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    note: text('note').notNull(),
    hasIssue: boolean('has_issue').notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [index('site_updates_project_idx').on(table.projectId, table.createdAt)],
);

export const siteUpdatePhotos = pgTable(
  'site_update_photos',
  {
    id: primaryId(),
    siteUpdateId: uuid('site_update_id')
      .notNull()
      .references(() => siteUpdates.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id),
    position: integer('position').notNull().default(0),
  },
  (table) => [unique('site_update_photos_unique').on(table.siteUpdateId, table.fileId)],
);
