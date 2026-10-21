import { createHash } from 'node:crypto';
import { ValidationFailedError } from '@lintel/shared';
import type { DetectedFileKind, FileInspector } from '../deliverables/file-inspector.port';
import { cleanOriginalName } from '../deliverables/file-rules';
import type { ObjectStorage } from '../ports/object-storage.port';

const UNSUPPORTED =
  'This file type is not supported. Upload a JPEG, PNG, WebP or HEIC image, a PDF, a DWG drawing or an Office document.';

export interface StoredUpload {
  readonly storageKey: string;
  readonly detected: DetectedFileKind;
  readonly originalName: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
}

/**
 * Checks an upload by its content (never its name), then writes the bytes
 * under a random key. Same allow-list and rules as task attachments. The
 * caller saves the metadata and calls `discard` if that fails.
 */
export async function storeUpload(
  storage: ObjectStorage,
  inspector: FileInspector,
  upload: { readonly buffer: Buffer; readonly originalName: string; readonly scope: string },
  now: Date,
): Promise<StoredUpload> {
  if (upload.buffer.length === 0) {
    throw new ValidationFailedError('The file is empty.', [{ field: 'file', message: 'Empty.' }]);
  }
  const detected = inspector.detect(upload.buffer, upload.originalName);
  if (!detected) {
    throw new ValidationFailedError(UNSUPPORTED, [{ field: 'file', message: UNSUPPORTED }]);
  }
  const storageKey = inspector.objectKey(upload.scope, detected.extension, now);
  await storage.putObject(storageKey, upload.buffer, detected.contentType);
  return {
    storageKey,
    detected,
    originalName: cleanOriginalName(upload.originalName, detected.extension),
    sizeBytes: upload.buffer.length,
    checksumSha256: createHash('sha256').update(upload.buffer).digest('hex'),
  };
}

/** Removes bytes whose metadata could not be saved, so nothing is orphaned. */
export async function discardUpload(storage: ObjectStorage, stored: StoredUpload): Promise<void> {
  await storage.deleteObject(stored.storageKey).catch(() => undefined);
}
