import {
  checkDocumentArchive,
  DOCUMENT_FOLDERS,
  type DocumentFolder,
  type DocumentKind,
  type DocumentViewer,
  documentKindOf,
} from '@lintel/domain';
import { and, count, desc, eq, ilike, inArray, isNull, like, or, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { files, projectDocuments } from '../../schema';
import { type FileSummaryView, loadFileSummaries } from '../deliverables/file-summary.query';
import { loadUserSummaries } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';

export interface ProjectDocumentView {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly folder: DocumentFolder;
  readonly visibility: 'project' | 'confidential';
  readonly kind: DocumentKind;
  readonly file: FileSummaryView;
  readonly addedBy: UserSummaryView;
  readonly createdAt: string;
  readonly archivedAt: string | null;
  readonly viewerCanArchive: boolean;
  readonly version: number;
}

export type DocumentKindFilter = 'image' | 'pdf' | 'drawing' | 'office';

export interface DocumentListFilters {
  readonly folder?: DocumentFolder | undefined;
  readonly kind?: DocumentKindFilter | undefined;
  readonly search?: string | undefined;
  readonly page: number;
  readonly pageSize: number;
}

/** Who is reading: confidential rows (and their titles) are left out unless they may see them. */
export interface DocumentReader {
  readonly viewer: DocumentViewer;
  readonly includeConfidential: boolean;
}

const KIND_CONDITIONS: Readonly<Record<DocumentKindFilter, SQL>> = {
  image: inArray(files.contentType, ['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  pdf: eq(files.contentType, 'application/pdf'),
  drawing: eq(files.contentType, 'image/vnd.dwg'),
  office: like(files.contentType, 'application/vnd.openxmlformats-officedocument.%'),
};

function visibleTo(reader: DocumentReader): SQL | undefined {
  if (reader.includeConfidential) return undefined;
  return or(
    eq(files.visibility, 'project'),
    eq(projectDocuments.addedByUserId, reader.viewer.userId),
  );
}

function libraryWhere(projectId: string, reader: DocumentReader, filters: DocumentListFilters) {
  // Searched text is matched literally: % and _ are not wildcards here.
  const search = filters.search?.trim().replace(/[\\%_]/g, '\\$&');
  return and(
    eq(projectDocuments.projectId, projectId),
    isNull(projectDocuments.archivedAt),
    visibleTo(reader),
    filters.kind ? KIND_CONDITIONS[filters.kind] : undefined,
    search
      ? or(ilike(projectDocuments.title, `%${search}%`), ilike(files.originalName, `%${search}%`))
      : undefined,
  );
}

async function toViews(
  db: DatabaseExecutor,
  rows: readonly (typeof projectDocuments.$inferSelect & { visibility: string })[],
  reader: DocumentReader,
): Promise<ProjectDocumentView[]> {
  const [fileViews, people] = await Promise.all([
    loadFileSummaries(
      db,
      rows.map((row) => row.fileId),
      true,
    ),
    loadUserSummaries(
      db,
      rows.map((row) => row.addedByUserId),
    ),
  ]);
  return rows.flatMap((row) => {
    const file = fileViews.get(row.fileId);
    const addedBy = people.get(row.addedByUserId);
    if (!file || !addedBy) return [];
    const visibility = row.visibility === 'project' ? 'project' : 'confidential';
    return [
      {
        id: row.id,
        projectId: row.projectId,
        title: row.title,
        folder: row.folder,
        visibility,
        kind: documentKindOf(file.contentType),
        file,
        addedBy,
        createdAt: row.createdAt.toISOString(),
        archivedAt: row.archivedAt?.toISOString() ?? null,
        viewerCanArchive: checkDocumentArchive(
          { visibility, addedByUserId: row.addedByUserId, archived: row.archivedAt !== null },
          reader.viewer,
        ).allowed,
        version: row.version,
      },
    ];
  });
}

/**
 * One page of a project's library, newest first, with counts per folder for
 * the same search. Callers check project access first; confidential
 * documents never reach people who may not see them.
 */
export async function listProjectDocuments(
  db: DatabaseExecutor,
  projectId: string,
  reader: DocumentReader,
  filters: DocumentListFilters,
) {
  const where = libraryWhere(projectId, reader, { ...filters, folder: undefined });
  const inFolder = and(
    where,
    filters.folder ? eq(projectDocuments.folder, filters.folder) : undefined,
  );
  const rows = await db
    .select({ document: projectDocuments, visibility: files.visibility })
    .from(projectDocuments)
    .innerJoin(files, eq(files.id, projectDocuments.fileId))
    .where(inFolder)
    .orderBy(desc(projectDocuments.createdAt), desc(projectDocuments.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  const perFolder = await db
    .select({ folder: projectDocuments.folder, total: count() })
    .from(projectDocuments)
    .innerJoin(files, eq(files.id, projectDocuments.fileId))
    .where(where)
    .groupBy(projectDocuments.folder);
  const folderCounts = Object.fromEntries(
    DOCUMENT_FOLDERS.map((folder) => [
      folder,
      perFolder.find((row) => row.folder === folder)?.total ?? 0,
    ]),
  ) as Record<DocumentFolder, number>;
  const all = perFolder.reduce((sum, row) => sum + row.total, 0);
  const totalItems = filters.folder ? folderCounts[filters.folder] : all;
  return {
    items: await toViews(
      db,
      rows.map((row) => ({ ...row.document, visibility: row.visibility })),
      reader,
    ),
    page: filters.page,
    pageSize: filters.pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / filters.pageSize)),
    folderCounts: { all, ...folderCounts },
  };
}

/** One document (archived ones too). Callers resolve access with ProjectDocumentAccess first. */
export async function findProjectDocument(
  db: DatabaseExecutor,
  documentId: string,
  reader: DocumentReader,
): Promise<ProjectDocumentView | null> {
  const [row] = await db
    .select({ document: projectDocuments, visibility: files.visibility })
    .from(projectDocuments)
    .innerJoin(files, eq(files.id, projectDocuments.fileId))
    .where(and(eq(projectDocuments.id, documentId), visibleTo(reader)));
  if (!row) return null;
  const [view] = await toViews(db, [{ ...row.document, visibility: row.visibility }], reader);
  return view ?? null;
}
