/** Where a project document is filed. "other" is the default when nobody chooses. */
export const DOCUMENT_FOLDERS = [
  'drawings',
  'contracts',
  'mood_boards',
  'site_photos',
  'other',
] as const;
export type DocumentFolder = (typeof DOCUMENT_FOLDERS)[number];

export const DOCUMENT_FOLDER_LABELS: Readonly<Record<DocumentFolder, string>> = {
  drawings: 'Drawings',
  contracts: 'Contracts',
  mood_boards: 'Mood boards',
  site_photos: 'Site photos',
  other: 'Other',
};

/** "project": everyone on the project. "confidential": people who manage it (and the uploader). */
export const DOCUMENT_VISIBILITIES = ['project', 'confidential'] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

/** How the viewer relates to the document's project. Computed on the server. */
export interface DocumentViewer {
  readonly userId: string;
  /** Project manager, or someone who manages every project (owner, administrator). */
  readonly canManageProject: boolean;
  /** Holds `files.view_confidential`. */
  readonly canViewConfidential: boolean;
}

export interface DocumentFacts {
  readonly visibility: DocumentVisibility;
  readonly addedByUserId: string;
}

export type DocumentRuleCheck =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

/** Whether confidential material is open to this viewer. */
export function canViewConfidentialDocuments(viewer: DocumentViewer): boolean {
  return viewer.canManageProject || viewer.canViewConfidential;
}

/**
 * Who may see a document, including its title and file name. Everyone with
 * project access sees project documents; confidential ones only reach people
 * who manage the project, holders of `files.view_confidential`, and the person
 * who added it. Hidden documents are left out entirely, never shown redacted.
 */
export function canSeeDocument(document: DocumentFacts, viewer: DocumentViewer): boolean {
  if (document.visibility === 'project') return true;
  return document.addedByUserId === viewer.userId || canViewConfidentialDocuments(viewer);
}

/** Anyone on the project may add documents; only people who may read confidential ones may file them. */
export function checkDocumentUpload(
  visibility: DocumentVisibility,
  viewer: DocumentViewer,
): DocumentRuleCheck {
  if (visibility === 'confidential' && !canViewConfidentialDocuments(viewer)) {
    return {
      allowed: false,
      reason: 'Only the project manager can add confidential documents.',
    };
  }
  return { allowed: true };
}

/** The person who added a document, or a project manager, may archive it. Archiving happens once. */
export function checkDocumentArchive(
  document: DocumentFacts & { readonly archived: boolean },
  viewer: DocumentViewer,
): DocumentRuleCheck {
  if (document.archived) return { allowed: false, reason: 'This document is already archived.' };
  if (document.addedByUserId !== viewer.userId && !viewer.canManageProject) {
    return {
      allowed: false,
      reason: 'Only the person who added this document or the project manager can archive it.',
    };
  }
  return { allowed: true };
}

export type DocumentKind = 'image' | 'pdf' | 'drawing' | 'spreadsheet' | 'presentation' | 'text';

const KIND_BY_CONTENT_TYPE: Readonly<Record<string, DocumentKind>> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/heic': 'image',
  'application/pdf': 'pdf',
  'image/vnd.dwg': 'drawing',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'text',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation',
};

/** What sort of file it is, from the type detected when it was uploaded. */
export function documentKindOf(contentType: string): DocumentKind {
  return KIND_BY_CONTENT_TYPE[contentType] ?? 'text';
}

/** A title from the file name when none is given: no extension, no underscores. */
export function titleFromFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[a-z0-9]{1,5}$/i, '');
  const spaced = withoutExtension.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (spaced.length > 0 ? spaced : 'Untitled document').slice(0, 200);
}
