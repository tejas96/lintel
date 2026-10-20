import {
  createWorkflowTemplatePreset,
  type ProjectType,
  validateWorkflowTemplate,
  type WorkflowTemplateDefinition,
} from '@lintel/domain';
import {
  type Clock,
  NotFoundError,
  PreconditionFailedError,
  StaleVersionError,
  ValidationFailedError,
} from '@lintel/shared';
import { requireCapability } from '../common/capability-guard';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { TemplateRecord, TemplateVersionRecord } from './template.store';

type TemplateStores = Pick<ApplicationStores, 'templates' | 'records'>;

export interface NewTemplateInput {
  readonly name: string;
  readonly description: string | null;
  readonly projectType: ProjectType;
  /** Copy this version's definition; otherwise start from the built-in preset. */
  readonly copyFromVersionId: string | null;
}

export interface DraftInput {
  readonly definition: WorkflowTemplateDefinition;
  readonly changeNotes: string | null;
  /** The draft's version as last read, or null when the caller saw no draft. */
  readonly expectedVersion: number | null;
}

/** Throws every rule the schema cannot express (keys, references, loops) as field details. */
export function assertValidDefinition(definition: WorkflowTemplateDefinition): void {
  const issues = validateWorkflowTemplate(definition);
  if (issues.length === 0) return;
  throw new ValidationFailedError(
    'The workflow has problems to fix.',
    issues.map((issue) => ({ field: `definition.${issue.path}`, message: issue.message })),
  );
}

/**
 * Template authoring. Each template has at most one draft; publishing makes
 * it the published version and retires the previous one. Published versions
 * never change, so projects keep exactly the workflow they started with.
 */
export class ManageTemplatesCommands {
  constructor(
    private readonly uow: UnitOfWork<TemplateStores>,
    private readonly clock: Clock,
  ) {}

  async create(context: RequestContext, input: NewTemplateInput): Promise<{ id: string }> {
    requireCapability(context, 'templates.manage');
    return this.uow.transaction(async (stores) => {
      const definition = await this.startingDefinition(stores, input);
      const template = await stores.templates.createTemplate({
        name: input.name,
        description: input.description,
        projectType: input.projectType,
        createdByUserId: context.actor.userId,
      });
      const draft = await stores.templates.insertDraft(template.id, 1, definition, null);
      await this.audit(stores, context, 'template.created', template.id, {
        name: input.name,
        projectType: input.projectType,
        copiedFromVersionId: input.copyFromVersionId,
        draftVersionId: draft.id,
      });
      return { id: template.id };
    });
  }

  async saveDraft(context: RequestContext, templateId: string, input: DraftInput): Promise<void> {
    requireCapability(context, 'templates.manage');
    assertValidDefinition(input.definition);
    await this.uow.transaction(async (stores) => {
      await this.editable(stores, templateId);
      const versions = await stores.templates.versionsOf(templateId);
      const draft = versions.find((version) => version.status === 'draft');
      let saved: TemplateVersionRecord | null;
      if (draft) {
        if (input.expectedVersion === null) throw new StaleVersionError('This template draft');
        saved = await stores.templates.updateDraft(
          draft.id,
          input.expectedVersion,
          input.definition,
          input.changeNotes,
        );
      } else {
        if (input.expectedVersion !== null) throw new StaleVersionError('This template draft');
        const next = Math.max(0, ...versions.map((version) => version.versionNumber)) + 1;
        saved = await stores.templates.insertDraft(
          templateId,
          next,
          input.definition,
          input.changeNotes,
        );
      }
      if (!saved) throw new StaleVersionError('This template draft');
      await this.audit(stores, context, 'template.draft_saved', templateId, {
        versionId: saved.id,
        versionNumber: saved.versionNumber,
      });
    });
  }

  async publish(context: RequestContext, templateId: string, expectedVersion: number) {
    requireCapability(context, 'templates.manage');
    await this.uow.transaction(async (stores) => {
      await this.editable(stores, templateId);
      const versions = await stores.templates.versionsOf(templateId);
      const draft = versions.find((version) => version.status === 'draft');
      if (!draft) throw new PreconditionFailedError('There is no draft to publish.');
      assertValidDefinition(draft.definition);
      const published = await stores.templates.publish(
        draft.id,
        expectedVersion,
        context.actor.userId,
        this.clock.now(),
      );
      if (!published) throw new StaleVersionError('This template draft');
      const previous = versions.filter((version) => version.status === 'published');
      for (const version of previous) await stores.templates.retire(version.id);
      await this.audit(stores, context, 'template.published', templateId, {
        versionId: published.id,
        versionNumber: published.versionNumber,
        retiredVersionIds: previous.map((version) => version.id),
      });
    });
  }

  async archive(context: RequestContext, templateId: string): Promise<void> {
    requireCapability(context, 'templates.manage');
    await this.uow.transaction(async (stores) => {
      const template = await stores.templates.lockTemplate(templateId);
      if (!template) throw new NotFoundError('Template');
      if (template.archivedAt) return;
      await stores.templates.archive(templateId, this.clock.now());
      await this.audit(stores, context, 'template.archived', templateId, { name: template.name });
    });
  }

  private async startingDefinition(
    stores: TemplateStores,
    input: NewTemplateInput,
  ): Promise<WorkflowTemplateDefinition> {
    if (!input.copyFromVersionId) return createWorkflowTemplatePreset(input.projectType).definition;
    const source = await stores.templates.findVersion(input.copyFromVersionId);
    if (!source) {
      throw new ValidationFailedError('That template version does not exist.', [
        { field: 'copyFromVersionId', message: 'Unknown template version.' },
      ]);
    }
    return source.definition;
  }

  private async editable(stores: TemplateStores, templateId: string): Promise<TemplateRecord> {
    const template = await stores.templates.lockTemplate(templateId);
    if (!template) throw new NotFoundError('Template');
    if (template.archivedAt) {
      throw new PreconditionFailedError('Archived templates cannot be changed.');
    }
    return template;
  }

  private async audit(
    stores: TemplateStores,
    context: RequestContext,
    action: string,
    templateId: string,
    after: Record<string, unknown>,
  ): Promise<void> {
    await stores.records.appendAudit({
      actorUserId: context.actor.userId,
      action,
      entityType: 'workflow_template',
      entityId: templateId,
      after,
      requestId: context.requestId,
    });
  }
}
