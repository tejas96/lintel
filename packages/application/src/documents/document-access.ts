import {
  type Actor,
  canSeeDocument,
  canViewConfidentialDocuments,
  checkDocumentArchive,
  checkDocumentUpload,
  type DocumentViewer,
} from '@lintel/domain';
import { NotFoundError } from '@lintel/shared';
import { type ProjectAccess, ProjectAccessService } from '../access/project-access.service';
import type { ApplicationStores } from '../common/unit-of-work';
import type { ProjectDocumentRecord } from './project-document.store';

type Stores = Pick<ApplicationStores, 'access' | 'documents'>;

export function documentViewerOf(
  actor: Actor,
  access: Pick<ProjectAccess, 'canManage'>,
): DocumentViewer {
  return {
    userId: actor.userId,
    canManageProject: access.canManage,
    canViewConfidential: actor.capabilities.has('files.view_confidential'),
  };
}

/** What the viewer may see and do in one project's library. */
export interface LibraryViewer {
  readonly projectId: string;
  readonly viewer: DocumentViewer;
  /** Confidential documents are listed for this viewer (otherwise only their own). */
  readonly includeConfidential: boolean;
  readonly canUpload: boolean;
  readonly canUploadConfidential: boolean;
}

function libraryViewer(projectId: string, viewer: DocumentViewer): LibraryViewer {
  return {
    projectId,
    viewer,
    includeConfidential: canViewConfidentialDocuments(viewer),
    canUpload: checkDocumentUpload('project', viewer).allowed,
    canUploadConfidential: checkDocumentUpload('confidential', viewer).allowed,
  };
}

/**
 * Resolves who is looking at a library or a document. Missing projects,
 * missing documents and documents the viewer may not see all answer 404, so
 * neither IDs nor confidential titles can be probed.
 */
export class ProjectDocumentAccess {
  constructor(private readonly stores: Stores) {}

  async forProject(actor: Actor, projectId: string): Promise<LibraryViewer> {
    const access = await new ProjectAccessService(this.stores.access).requireView(actor, projectId);
    return libraryViewer(projectId, documentViewerOf(actor, access));
  }

  async forDocument(
    actor: Actor,
    documentId: string,
  ): Promise<
    LibraryViewer & { readonly document: ProjectDocumentRecord; readonly canArchive: boolean }
  > {
    const document = await this.stores.documents.find(documentId);
    if (!document) throw new NotFoundError('Document');
    const access = await new ProjectAccessService(this.stores.access).requireView(
      actor,
      document.projectId,
      'Document',
    );
    const viewer = documentViewerOf(actor, access);
    if (!canSeeDocument(document, viewer)) throw new NotFoundError('Document');
    return {
      ...libraryViewer(document.projectId, viewer),
      document,
      canArchive: checkDocumentArchive(
        { ...document, archived: document.archivedAt !== null },
        viewer,
      ).allowed,
    };
  }
}
