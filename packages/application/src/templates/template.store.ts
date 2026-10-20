import type { ProjectType, WorkflowTemplateDefinition } from '@lintel/domain';

export type TemplateVersionStatus = 'draft' | 'published' | 'retired';

export interface TemplateRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly projectType: ProjectType;
  readonly archivedAt: Date | null;
}

export interface TemplateVersionRecord {
  readonly id: string;
  readonly templateId: string;
  readonly versionNumber: number;
  readonly status: TemplateVersionStatus;
  readonly definition: WorkflowTemplateDefinition;
  readonly changeNotes: string | null;
  readonly version: number;
}

export interface NewTemplate {
  readonly name: string;
  readonly description: string | null;
  readonly projectType: ProjectType;
  readonly createdByUserId: string;
}

/**
 * Write-side persistence for workflow templates. Published versions are
 * immutable: only draft versions are ever updated.
 */
export interface TemplateStore {
  findTemplate(templateId: string): Promise<TemplateRecord | null>;
  /** Locks the template row for the rest of the transaction. Null when it does not exist. */
  lockTemplate(templateId: string): Promise<TemplateRecord | null>;
  findVersion(versionId: string): Promise<TemplateVersionRecord | null>;
  versionsOf(templateId: string): Promise<TemplateVersionRecord[]>;
  createTemplate(template: NewTemplate): Promise<TemplateRecord>;
  insertDraft(
    templateId: string,
    versionNumber: number,
    definition: WorkflowTemplateDefinition,
    changeNotes: string | null,
  ): Promise<TemplateVersionRecord>;
  /** Null when the draft's version no longer matches. */
  updateDraft(
    versionId: string,
    expectedVersion: number,
    definition: WorkflowTemplateDefinition,
    changeNotes: string | null,
  ): Promise<TemplateVersionRecord | null>;
  /** Draft → published. Null when the draft's version no longer matches. */
  publish(
    versionId: string,
    expectedVersion: number,
    publishedByUserId: string,
    at: Date,
  ): Promise<TemplateVersionRecord | null>;
  retire(versionId: string): Promise<void>;
  archive(templateId: string, at: Date): Promise<void>;
}
