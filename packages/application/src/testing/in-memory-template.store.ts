import type { WorkflowTemplateDefinition } from '@lintel/domain';
import type {
  NewTemplate,
  TemplateRecord,
  TemplateStore,
  TemplateVersionRecord,
} from '../templates/template.store';

/** Test double for TemplateStore with the same version-check semantics as the SQL version. */
export class InMemoryTemplateStore implements TemplateStore {
  readonly templates: TemplateRecord[] = [];
  readonly versions: TemplateVersionRecord[] = [];
  private sequence = 0;

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  private replaceVersion(id: string, change: Partial<TemplateVersionRecord>) {
    const index = this.versions.findIndex((version) => version.id === id);
    const current = this.versions[index];
    if (!current) return null;
    const next = { ...current, ...change, version: current.version + 1 };
    this.versions[index] = next;
    return next;
  }

  private async isDraftAt(versionId: string, expectedVersion: number): Promise<boolean> {
    const current = await this.findVersion(versionId);
    return current?.status === 'draft' && current.version === expectedVersion;
  }

  async findTemplate(templateId: string) {
    return this.templates.find((template) => template.id === templateId) ?? null;
  }
  async lockTemplate(templateId: string) {
    return this.findTemplate(templateId);
  }
  async findVersion(versionId: string) {
    return this.versions.find((version) => version.id === versionId) ?? null;
  }
  async versionsOf(templateId: string) {
    return this.versions.filter((version) => version.templateId === templateId);
  }
  async createTemplate(template: NewTemplate) {
    const record: TemplateRecord = {
      id: this.nextId('template'),
      name: template.name,
      description: template.description,
      projectType: template.projectType,
      archivedAt: null,
    };
    this.templates.push(record);
    return record;
  }
  async insertDraft(
    templateId: string,
    versionNumber: number,
    definition: WorkflowTemplateDefinition,
    changeNotes: string | null,
  ) {
    const record: TemplateVersionRecord = {
      id: this.nextId('version'),
      templateId,
      versionNumber,
      status: 'draft',
      definition,
      changeNotes,
      version: 1,
    };
    this.versions.push(record);
    return record;
  }
  async updateDraft(
    versionId: string,
    expectedVersion: number,
    definition: WorkflowTemplateDefinition,
    changeNotes: string | null,
  ) {
    if (!(await this.isDraftAt(versionId, expectedVersion))) return null;
    return this.replaceVersion(versionId, { definition, changeNotes });
  }
  async publish(versionId: string, expectedVersion: number) {
    if (!(await this.isDraftAt(versionId, expectedVersion))) return null;
    return this.replaceVersion(versionId, { status: 'published' });
  }
  async retire(versionId: string) {
    this.replaceVersion(versionId, { status: 'retired' });
  }
  async archive(templateId: string, at: Date) {
    const index = this.templates.findIndex((template) => template.id === templateId);
    const current = this.templates[index];
    if (current) this.templates[index] = { ...current, archivedAt: at };
  }
}
