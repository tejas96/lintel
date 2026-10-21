import {
  canSeeDocument,
  checkDocumentArchive,
  checkDocumentUpload,
  DOCUMENT_FOLDER_LABELS,
  type DocumentFolder,
  type DocumentVisibility,
  titleFromFileName,
} from '@lintel/domain';
import {
  type Clock,
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
  StaleVersionError,
} from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { FileInspector } from '../deliverables/file-inspector.port';
import type { ObjectStorage } from '../ports/object-storage.port';
import { documentViewerOf } from './document-access';
import type { ProjectDocumentRecord } from './project-document.store';
import { discardUpload, storeUpload } from './stored-upload';

export interface AddDocumentInput {
  readonly buffer: Buffer;
  readonly originalName: string;
  /** Empty means "use the file name". */
  readonly title: string | null;
  readonly folder: DocumentFolder;
  readonly visibility: DocumentVisibility;
}

export interface DocumentCommandDependencies {
  readonly uow: UnitOfWork<ApplicationStores>;
  readonly clock: Clock;
  readonly storage: ObjectStorage;
  readonly inspector: FileInspector;
}

/** Activity is read by everyone on the project, so confidential titles never appear in it. */
function activityName(document: Pick<ProjectDocumentRecord, 'title' | 'visibility'>): string {
  return document.visibility === 'confidential' ? 'a confidential document' : `“${document.title}”`;
}

/**
 * The project document library: add (upload with content checks) and
 * archive (soft delete). Every change writes activity and audit rows in the
 * same transaction.
 */
export class ProjectDocumentCommands {
  constructor(private readonly deps: DocumentCommandDependencies) {}

  async add(
    context: RequestContext,
    projectId: string,
    input: AddDocumentInput,
  ): Promise<ProjectDocumentRecord> {
    const access = await new ProjectAccessService(this.deps.uow.stores.access).requireView(
      context.actor,
      projectId,
    );
    const check = checkDocumentUpload(input.visibility, documentViewerOf(context.actor, access));
    if (!check.allowed) throw new ForbiddenError(check.reason);
    const now = this.deps.clock.now();
    const stored = await storeUpload(
      this.deps.storage,
      this.deps.inspector,
      { buffer: input.buffer, originalName: input.originalName, scope: 'projects' },
      now,
    );
    try {
      return await this.deps.uow.transaction(async (stores) => {
        await new ProjectAccessService(stores.access).requireView(context.actor, projectId);
        const file = await stores.deliverables.createFile({
          storageKey: stored.storageKey,
          originalName: stored.originalName,
          contentType: stored.detected.contentType,
          sizeBytes: stored.sizeBytes,
          checksumSha256: stored.checksumSha256,
          projectId,
          visibility: input.visibility,
          uploadedByUserId: context.actor.userId,
        });
        const title = input.title?.trim() || titleFromFileName(stored.originalName);
        const document = await stores.documents.insert({
          projectId,
          fileId: file.id,
          title,
          folder: input.folder,
          addedByUserId: context.actor.userId,
        });
        await this.record(stores, context, document, 'added');
        return document;
      });
    } catch (error) {
      await discardUpload(this.deps.storage, stored);
      throw error;
    }
  }

  async archive(
    context: RequestContext,
    documentId: string,
    input: { readonly version: number; readonly reason: string | null },
  ): Promise<ProjectDocumentRecord> {
    return this.deps.uow.transaction(async (stores) => {
      const document = await stores.documents.findForUpdate(documentId);
      if (!document) throw new NotFoundError('Document');
      const access = await new ProjectAccessService(stores.access).requireView(
        context.actor,
        document.projectId,
        'Document',
      );
      const viewer = documentViewerOf(context.actor, access);
      if (!canSeeDocument(document, viewer)) throw new NotFoundError('Document');
      const check = checkDocumentArchive(
        { ...document, archived: document.archivedAt !== null },
        viewer,
      );
      if (!check.allowed) {
        throw document.archivedAt
          ? new PreconditionFailedError(check.reason)
          : new ForbiddenError(check.reason);
      }
      if (document.version !== input.version) throw new StaleVersionError('This document');
      const at = this.deps.clock.now();
      const archived = await stores.documents.archive(documentId, input.version, {
        at,
        byUserId: context.actor.userId,
        reason: input.reason,
      });
      if (!archived) throw new StaleVersionError('This document');
      const after = { ...document, archivedAt: at, version: document.version + 1 };
      await this.record(stores, context, after, 'archived', input.reason);
      return after;
    });
  }

  private async record(
    stores: ApplicationStores,
    context: RequestContext,
    document: ProjectDocumentRecord,
    action: 'added' | 'archived',
    reason: string | null = null,
  ): Promise<void> {
    const folder = DOCUMENT_FOLDER_LABELS[document.folder].toLowerCase();
    await stores.records.appendActivity({
      projectId: document.projectId,
      taskId: null,
      actorUserId: context.actor.userId,
      type: `document.${action}`,
      summary:
        action === 'added'
          ? `Added ${activityName(document)} to ${folder}.`
          : `Archived ${activityName(document)} from ${folder}.`,
      payload: { documentId: document.id, folder: document.folder },
    });
    const confidential = document.visibility === 'confidential';
    await stores.records.appendAudit({
      actorUserId: context.actor.userId,
      action: `document.${action}`,
      entityType: 'project_document',
      entityId: document.id,
      before: action === 'archived' ? { archivedAt: null } : null,
      after: {
        projectId: document.projectId,
        fileId: document.fileId,
        folder: document.folder,
        visibility: document.visibility,
        ...(confidential ? {} : { title: document.title }),
        ...(action === 'archived'
          ? { archivedAt: document.archivedAt?.toISOString(), reason }
          : {}),
      },
      requestId: context.requestId,
    });
  }
}
