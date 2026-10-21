import type { TemplateUpdateSummary } from '@lintel/application';
import { index, jsonb, pgTable, uuid } from 'drizzle-orm/pg-core';
import { createdAt, primaryId } from './columns';
import { users } from './identity.schema';
import { projects } from './projects.schema';
import { workflowTemplateVersions } from './templates.schema';

/**
 * Every move of a project to a newer published version of its template.
 * The project's `template_version_id` points at the version it follows now.
 */
export const projectTemplateUpdates = pgTable(
  'project_template_updates',
  {
    id: primaryId(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    fromVersionId: uuid('from_version_id')
      .notNull()
      .references(() => workflowTemplateVersions.id),
    toVersionId: uuid('to_version_id')
      .notNull()
      .references(() => workflowTemplateVersions.id),
    appliedByUserId: uuid('applied_by_user_id')
      .notNull()
      .references(() => users.id),
    summary: jsonb('summary').$type<TemplateUpdateSummary>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('project_template_updates_project_idx').on(table.projectId, table.createdAt)],
);
