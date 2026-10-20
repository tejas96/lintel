import type {
  NewTemplate,
  TemplateRecord,
  TemplateStore,
  TemplateVersionRecord,
} from '@lintel/application';
import type { WorkflowTemplateDefinition } from '@lintel/domain';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { workflowTemplates, workflowTemplateVersions } from '../schema';

function toTemplate(row: typeof workflowTemplates.$inferSelect): TemplateRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    projectType: row.projectType,
    archivedAt: row.archivedAt,
  };
}

function toVersion(row: typeof workflowTemplateVersions.$inferSelect): TemplateVersionRecord {
  return {
    id: row.id,
    templateId: row.templateId,
    versionNumber: row.versionNumber,
    status: row.status,
    definition: row.definition,
    changeNotes: row.changeNotes,
    version: row.version,
  };
}

const isDraftAt = (versionId: string, expectedVersion: number) =>
  and(
    eq(workflowTemplateVersions.id, versionId),
    eq(workflowTemplateVersions.version, expectedVersion),
    eq(workflowTemplateVersions.status, 'draft'),
  );

export class TemplateRepository implements TemplateStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async findTemplate(templateId: string) {
    const [row] = await this.db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, templateId));
    return row ? toTemplate(row) : null;
  }

  async lockTemplate(templateId: string) {
    const [row] = await this.db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, templateId))
      .for('update');
    return row ? toTemplate(row) : null;
  }

  async findVersion(versionId: string) {
    const [row] = await this.db
      .select()
      .from(workflowTemplateVersions)
      .where(eq(workflowTemplateVersions.id, versionId));
    return row ? toVersion(row) : null;
  }

  async versionsOf(templateId: string) {
    const rows = await this.db
      .select()
      .from(workflowTemplateVersions)
      .where(eq(workflowTemplateVersions.templateId, templateId))
      .orderBy(asc(workflowTemplateVersions.versionNumber));
    return rows.map(toVersion);
  }

  async createTemplate(template: NewTemplate) {
    const [row] = await this.db.insert(workflowTemplates).values(template).returning();
    if (!row) throw new Error('Creating the template returned no row.');
    return toTemplate(row);
  }

  async insertDraft(
    templateId: string,
    versionNumber: number,
    definition: WorkflowTemplateDefinition,
    changeNotes: string | null,
  ) {
    const [row] = await this.db
      .insert(workflowTemplateVersions)
      .values({ templateId, versionNumber, status: 'draft', definition, changeNotes })
      .returning();
    if (!row) throw new Error('Saving the template draft returned no row.');
    return toVersion(row);
  }

  async updateDraft(
    versionId: string,
    expectedVersion: number,
    definition: WorkflowTemplateDefinition,
    changeNotes: string | null,
  ) {
    const [row] = await this.db
      .update(workflowTemplateVersions)
      .set({
        definition,
        changeNotes,
        version: sql`${workflowTemplateVersions.version} + 1`,
        updatedAt: new Date(),
      })
      .where(isDraftAt(versionId, expectedVersion))
      .returning();
    return row ? toVersion(row) : null;
  }

  async publish(versionId: string, expectedVersion: number, publishedByUserId: string, at: Date) {
    const [row] = await this.db
      .update(workflowTemplateVersions)
      .set({
        status: 'published',
        publishedAt: at,
        publishedByUserId,
        version: sql`${workflowTemplateVersions.version} + 1`,
        updatedAt: at,
      })
      .where(isDraftAt(versionId, expectedVersion))
      .returning();
    return row ? toVersion(row) : null;
  }

  async retire(versionId: string) {
    await this.db
      .update(workflowTemplateVersions)
      .set({
        status: 'retired',
        version: sql`${workflowTemplateVersions.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workflowTemplateVersions.id, versionId),
          eq(workflowTemplateVersions.status, 'published'),
        ),
      );
  }

  async archive(templateId: string, at: Date) {
    await this.db
      .update(workflowTemplates)
      .set({ archivedAt: at, updatedAt: at })
      .where(eq(workflowTemplates.id, templateId));
  }
}
