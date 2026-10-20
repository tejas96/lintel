import { isImageContentType } from '@lintel/application';
import { and, inArray, isNull } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { files } from '../../schema';
import { loadUserSummaries } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';

export interface FileSummaryView {
  readonly id: string;
  readonly originalName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly isImage: boolean;
  readonly uploadedBy: UserSummaryView;
  readonly createdAt: string;
}

const UNKNOWN_UPLOADER: UserSummaryView = {
  id: '00000000-0000-0000-0000-000000000000',
  fullName: 'Unknown',
  designation: null,
  role: 'employee',
  avatarHue: 0,
  status: 'deactivated',
};

/**
 * File metadata views by ID. Deleted files are left out unless `includeDeleted`
 * (deliverable history keeps showing what was submitted). Never exposes storage keys.
 */
export async function loadFileSummaries(
  db: DatabaseExecutor,
  fileIds: readonly string[],
  includeDeleted = false,
): Promise<Map<string, FileSummaryView>> {
  const unique = [...new Set(fileIds)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({
      id: files.id,
      originalName: files.originalName,
      contentType: files.contentType,
      sizeBytes: files.sizeBytes,
      uploadedByUserId: files.uploadedByUserId,
      createdAt: files.createdAt,
    })
    .from(files)
    .where(and(inArray(files.id, unique), includeDeleted ? undefined : isNull(files.deletedAt)));
  const people = await loadUserSummaries(
    db,
    rows.map((row) => row.uploadedByUserId),
  );
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        originalName: row.originalName,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        isImage: isImageContentType(row.contentType),
        uploadedBy: people.get(row.uploadedByUserId) ?? UNKNOWN_UPLOADER,
        createdAt: row.createdAt.toISOString(),
      },
    ]),
  );
}

export async function findFileSummary(
  db: DatabaseExecutor,
  fileId: string,
): Promise<FileSummaryView | null> {
  return (await loadFileSummaries(db, [fileId])).get(fileId) ?? null;
}

/** Keeps the order of `ids` and drops any that are missing. */
export function pickFiles(map: Map<string, FileSummaryView>, ids: readonly string[]) {
  return ids.map((id) => map.get(id)).filter((file): file is FileSummaryView => Boolean(file));
}
