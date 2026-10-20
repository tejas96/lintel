import type { WorkflowTemplateDefinition } from '@lintel/domain';
import { index, integer, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId, updatedAt, version } from './columns';
import { projectTypeEnum, templateVersionStatusEnum } from './enums';
import { users } from './identity.schema';

export const workflowTemplates = pgTable('workflow_templates', {
  id: primaryId(),
  name: text('name').notNull(),
  description: text('description'),
  projectType: projectTypeEnum('project_type').notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  archivedAt: instant('archived_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * A published version is immutable: projects keep a reference to the exact
 * version they were created from. Edits create a new draft version.
 */
export const workflowTemplateVersions = pgTable(
  'workflow_template_versions',
  {
    id: primaryId(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => workflowTemplates.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    status: templateVersionStatusEnum('status').notNull().default('draft'),
    definition: jsonb('definition').$type<WorkflowTemplateDefinition>().notNull(),
    changeNotes: text('change_notes'),
    publishedAt: instant('published_at'),
    publishedByUserId: uuid('published_by_user_id').references(() => users.id),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique('template_versions_number_unique').on(table.templateId, table.versionNumber),
    index('template_versions_status_idx').on(table.templateId, table.status),
  ],
);
