import { index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId, updatedAt, version } from './columns';
import { files } from './deliverables.schema';
import { documentFolderEnum } from './enums';
import { users } from './identity.schema';
import { projects } from './projects.schema';

/**
 * A project-level document (drawing set, contract, mood board, site photo)
 * that is not tied to a task. Bytes and visibility live on the `files` row,
 * so the access-checked content route enforces confidentiality too.
 * Archiving is a soft delete: the row and the stored object stay.
 */
export const projectDocuments = pgTable(
  'project_documents',
  {
    id: primaryId(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id),
    title: text('title').notNull(),
    folder: documentFolderEnum('folder').notNull().default('other'),
    addedByUserId: uuid('added_by_user_id')
      .notNull()
      .references(() => users.id),
    archivedAt: instant('archived_at'),
    archivedByUserId: uuid('archived_by_user_id').references(() => users.id),
    archiveReason: text('archive_reason'),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('project_documents_file_unique').on(table.fileId),
    index('project_documents_project_idx').on(table.projectId, table.folder, table.createdAt),
  ],
);
