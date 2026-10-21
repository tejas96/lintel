import type { DocumentFolder, DocumentVisibility } from '@lintel/domain';

export interface ProjectDocumentRecord {
  readonly id: string;
  readonly projectId: string;
  readonly fileId: string;
  readonly title: string;
  readonly folder: DocumentFolder;
  /** The file's visibility, which is what the content route enforces. */
  readonly visibility: DocumentVisibility;
  readonly addedByUserId: string;
  readonly archivedAt: Date | null;
  readonly version: number;
}

export interface NewProjectDocument {
  readonly projectId: string;
  readonly fileId: string;
  readonly title: string;
  readonly folder: DocumentFolder;
  readonly addedByUserId: string;
}

export interface DocumentArchive {
  readonly at: Date;
  readonly byUserId: string;
  readonly reason: string | null;
}

/** Write-side persistence for the project document library. */
export interface ProjectDocumentStore {
  insert(document: NewProjectDocument): Promise<ProjectDocumentRecord>;
  find(documentId: string): Promise<ProjectDocumentRecord | null>;
  /** Locks the document row until the transaction ends. */
  findForUpdate(documentId: string): Promise<ProjectDocumentRecord | null>;
  /**
   * Archives the document and retires its file (status "deleted"; the stored
   * object is kept). False when `expectedVersion` no longer matches.
   */
  archive(documentId: string, expectedVersion: number, archive: DocumentArchive): Promise<boolean>;
}
