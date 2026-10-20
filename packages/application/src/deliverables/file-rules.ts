import type { Actor } from '@lintel/domain';
import { ValidationFailedError } from '@lintel/shared';
import type { ProjectAccess } from '../access/project-access.service';
import type { OperationsStores } from '../tasks/operations-context';
import type { FileRecord } from './deliverable.store';

/** Raster images a browser can show inline. DWG drawings are not images here. */
const IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

export function isImageContentType(contentType: string): boolean {
  return IMAGE_CONTENT_TYPES.has(contentType);
}

/**
 * Who may read a file: the uploader always; project files need project
 * access; confidential ones also need management rights or
 * `files.view_confidential`; private and unscoped files stay with the uploader.
 */
export function canReadFile(
  file: FileRecord,
  actor: Actor,
  access: Pick<ProjectAccess, 'canView' | 'canManage'> | null,
): boolean {
  if (file.status !== 'available') return false;
  if (file.uploadedByUserId === actor.userId) return true;
  if (file.visibility === 'private' || file.projectId === null || access === null) return false;
  if (!access.canView) return false;
  if (file.visibility === 'confidential') {
    return access.canManage || actor.capabilities.has('files.view_confidential');
  }
  return true;
}

/** Keeps the original name readable but harmless: no paths, control characters or huge names. */
export function cleanOriginalName(name: string, fallbackExtension: string): string {
  const base = name.split(/[/\\]/).pop() ?? '';
  const cleaned = [...base]
    .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
    .join('')
    .trim()
    .slice(0, 200);
  return cleaned.length > 0 ? cleaned : `upload.${fallbackExtension}`;
}

/**
 * Resolves a file someone wants to use inside a project (task attachment,
 * deliverable version, site photo). Unscoped uploads are claimed for the
 * project, but only by their uploader. Every refusal reads the same.
 */
export async function fileForProject(
  stores: Pick<OperationsStores, 'deliverables'>,
  actor: Actor,
  fileId: string,
  access: ProjectAccess,
  field: string,
): Promise<FileRecord> {
  const refuse = () =>
    new ValidationFailedError('Choose a file you uploaded or one that belongs to this project.', [
      { field, message: 'This file cannot be used here.' },
    ]);
  const file = await stores.deliverables.findFile(fileId);
  if (file?.status !== 'available') throw refuse();
  if (file.projectId === null) {
    if (file.uploadedByUserId !== actor.userId) throw refuse();
    await stores.deliverables.claimFileForProject(file.id, access.projectId);
    return { ...file, projectId: access.projectId, visibility: 'project' };
  }
  if (file.projectId !== access.projectId || !canReadFile(file, actor, access)) throw refuse();
  return file;
}
