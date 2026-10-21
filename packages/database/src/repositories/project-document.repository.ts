import type {
  DocumentArchive,
  NewProjectDocument,
  ProjectDocumentRecord,
  ProjectDocumentStore,
} from '@lintel/application';
import { and, eq, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { files, projectDocuments } from '../schema';

const documentColumns = {
  id: projectDocuments.id,
  projectId: projectDocuments.projectId,
  fileId: projectDocuments.fileId,
  title: projectDocuments.title,
  folder: projectDocuments.folder,
  visibility: files.visibility,
  addedByUserId: projectDocuments.addedByUserId,
  archivedAt: projectDocuments.archivedAt,
  version: projectDocuments.version,
};

type DocumentRow = Omit<ProjectDocumentRecord, 'visibility'> & {
  readonly visibility: 'project' | 'confidential' | 'private';
};

/** Documents are filed as project or confidential; a private file would be a data error, so treat it as confidential. */
function toRecord(row: DocumentRow): ProjectDocumentRecord {
  return { ...row, visibility: row.visibility === 'project' ? 'project' : 'confidential' };
}

/** The project document library, joined with each document's file for its visibility. */
export class ProjectDocumentRepository implements ProjectDocumentStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async insert(document: NewProjectDocument): Promise<ProjectDocumentRecord> {
    const [row] = await this.db
      .insert(projectDocuments)
      .values(document)
      .returning({ id: projectDocuments.id });
    if (!row) throw new Error('Saving the document returned no row.');
    const saved = await this.find(row.id);
    if (!saved) throw new Error('The saved document could not be read back.');
    return saved;
  }

  async find(documentId: string): Promise<ProjectDocumentRecord | null> {
    const [row] = await this.db
      .select(documentColumns)
      .from(projectDocuments)
      .innerJoin(files, eq(files.id, projectDocuments.fileId))
      .where(eq(projectDocuments.id, documentId));
    return row ? toRecord(row) : null;
  }

  async findForUpdate(documentId: string): Promise<ProjectDocumentRecord | null> {
    const [row] = await this.db
      .select(documentColumns)
      .from(projectDocuments)
      .innerJoin(files, eq(files.id, projectDocuments.fileId))
      .where(eq(projectDocuments.id, documentId))
      .for('update', { of: projectDocuments });
    return row ? toRecord(row) : null;
  }

  async archive(documentId: string, expectedVersion: number, archive: DocumentArchive) {
    const [row] = await this.db
      .update(projectDocuments)
      .set({
        archivedAt: archive.at,
        archivedByUserId: archive.byUserId,
        archiveReason: archive.reason,
        version: sql`${projectDocuments.version} + 1`,
        updatedAt: archive.at,
      })
      .where(
        and(
          eq(projectDocuments.id, documentId),
          eq(projectDocuments.version, expectedVersion),
          sql`${projectDocuments.archivedAt} IS NULL`,
        ),
      )
      .returning({ fileId: projectDocuments.fileId });
    if (!row) return false;
    // The bytes stay in storage; the file simply stops being served.
    await this.db
      .update(files)
      .set({ status: 'deleted', deletedAt: archive.at })
      .where(eq(files.id, row.fileId));
    return true;
  }
}
