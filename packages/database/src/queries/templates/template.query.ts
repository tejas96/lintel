import type { ProjectType, WorkflowTemplateDefinition } from '@lintel/domain';
import { and, asc, count, eq, inArray, isNull, type SQL, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { projects, workflowTemplates, workflowTemplateVersions } from '../../schema';

/** Strips `readonly` so stored definitions match the contract's (plain JSON) shape. */
type Plain<T> = T extends readonly (infer U)[]
  ? Plain<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Plain<T[K]> }
    : T;
export type PlainWorkflowDefinition = Plain<WorkflowTemplateDefinition>;

export interface TemplateSummaryView {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly projectType: ProjectType;
  readonly publishedVersion: {
    id: string;
    versionNumber: number;
    stageCount: number;
    taskCount: number;
  } | null;
  readonly hasDraft: boolean;
  readonly archivedAt: string | null;
}

export interface TemplateVersionView {
  readonly id: string;
  readonly versionNumber: number;
  readonly status: 'draft' | 'published' | 'retired';
  readonly definition: PlainWorkflowDefinition;
  readonly changeNotes: string | null;
  readonly publishedAt: string | null;
  readonly projectCount: number;
  readonly version: number;
}

export interface TemplateDetailView extends TemplateSummaryView {
  readonly versions: TemplateVersionView[];
}

const versionFacts = {
  templateId: workflowTemplateVersions.templateId,
  id: workflowTemplateVersions.id,
  versionNumber: workflowTemplateVersions.versionNumber,
  status: workflowTemplateVersions.status,
  stageCount: sql<number>`jsonb_array_length(${workflowTemplateVersions.definition}->'stages')`,
  taskCount: sql<number>`(select coalesce(sum(jsonb_array_length(stage->'tasks')), 0)::int
    from jsonb_array_elements(${workflowTemplateVersions.definition}->'stages') as stage)`,
};

async function summaries(db: DatabaseExecutor, where: SQL | undefined) {
  const templates = await db
    .select()
    .from(workflowTemplates)
    .where(where)
    .orderBy(asc(workflowTemplates.name));
  if (templates.length === 0) return [];
  const versions = await db
    .select(versionFacts)
    .from(workflowTemplateVersions)
    .where(
      inArray(
        workflowTemplateVersions.templateId,
        templates.map((template) => template.id),
      ),
    );
  return templates.map((template): TemplateSummaryView => {
    const own = versions.filter((version) => version.templateId === template.id);
    const published = own.find((version) => version.status === 'published');
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      projectType: template.projectType,
      publishedVersion: published
        ? {
            id: published.id,
            versionNumber: published.versionNumber,
            stageCount: published.stageCount,
            taskCount: published.taskCount,
          }
        : null,
      hasDraft: own.some((version) => version.status === 'draft'),
      archivedAt: template.archivedAt?.toISOString() ?? null,
    };
  });
}

/** Template catalogue for the template picker and the template library. */
export function listTemplates(
  db: DatabaseExecutor,
  filter: { projectType?: ProjectType | undefined; includeArchived: boolean },
): Promise<TemplateSummaryView[]> {
  return summaries(
    db,
    and(
      filter.projectType ? eq(workflowTemplates.projectType, filter.projectType) : undefined,
      filter.includeArchived ? undefined : isNull(workflowTemplates.archivedAt),
    ),
  );
}

export async function findTemplateDetail(
  db: DatabaseExecutor,
  templateId: string,
): Promise<TemplateDetailView | null> {
  const [summary] = await summaries(db, eq(workflowTemplates.id, templateId));
  if (!summary) return null;
  const rows = await db
    .select()
    .from(workflowTemplateVersions)
    .where(eq(workflowTemplateVersions.templateId, templateId))
    .orderBy(asc(workflowTemplateVersions.versionNumber));
  const usage = await db
    .select({ versionId: projects.templateVersionId, total: count() })
    .from(projects)
    .where(
      inArray(
        projects.templateVersionId,
        rows.map((row) => row.id),
      ),
    )
    .groupBy(projects.templateVersionId);
  const projectCounts = new Map(usage.map((row) => [row.versionId, row.total]));
  return {
    ...summary,
    versions: rows.map((row) => ({
      id: row.id,
      versionNumber: row.versionNumber,
      status: row.status,
      // Stored as JSON, so it is plain data at runtime; only `readonly` is dropped.
      definition: row.definition as PlainWorkflowDefinition,
      changeNotes: row.changeNotes,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      projectCount: projectCounts.get(row.id) ?? 0,
      version: row.version,
    })),
  };
}
