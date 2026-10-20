import { createHash } from 'node:crypto';
import type { Actor } from '@lintel/domain';
import { ForbiddenError, NotFoundError, ValidationFailedError } from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { ObjectStorage } from '../ports/object-storage.port';
import type { OperationsDependencies, OperationsStores } from '../tasks/operations-context';
import { isParticipant, loadTaskForActor } from '../tasks/task-loader';
import { assertTaskOpen } from '../tasks/task-validation';
import type { FileRecord } from './deliverable.store';
import type { FileInspector } from './file-inspector.port';
import { canReadFile, cleanOriginalName, fileForProject } from './file-rules';

export interface UploadFileInput {
  readonly buffer: Buffer;
  readonly originalName: string;
  readonly projectId: string | null;
  readonly visibility: 'project' | 'confidential' | null;
}

const UNSUPPORTED =
  'This file type is not supported. Upload a JPEG, PNG, WebP or HEIC image, a PDF, a DWG drawing or an Office document.';

/** Uploading, attaching and downloading files. Bytes live in object storage, metadata in the DB. */
export class FileCommands {
  constructor(
    private readonly deps: OperationsDependencies,
    private readonly storage: ObjectStorage,
    private readonly inspector: FileInspector,
  ) {}

  async upload(context: RequestContext, input: UploadFileInput): Promise<FileRecord> {
    if (input.buffer.length === 0) {
      throw new ValidationFailedError('The file is empty.', [{ field: 'file', message: 'Empty.' }]);
    }
    if (input.projectId) {
      await new ProjectAccessService(this.deps.uow.stores.access).requireView(
        context.actor,
        input.projectId,
      );
    }
    const detected = this.inspector.detect(input.buffer, input.originalName);
    if (!detected) {
      throw new ValidationFailedError(UNSUPPORTED, [{ field: 'file', message: UNSUPPORTED }]);
    }
    const now = this.deps.clock.now();
    const key = this.inspector.objectKey(
      input.projectId ? 'projects' : 'uploads',
      detected.extension,
      now,
    );
    await this.storage.putObject(key, input.buffer, detected.contentType);
    try {
      return await this.deps.uow.transaction(async (stores) => {
        const file = await stores.deliverables.createFile({
          storageKey: key,
          originalName: cleanOriginalName(input.originalName, detected.extension),
          contentType: detected.contentType,
          sizeBytes: input.buffer.length,
          checksumSha256: createHash('sha256').update(input.buffer).digest('hex'),
          projectId: input.projectId,
          visibility: input.projectId ? (input.visibility ?? 'project') : 'private',
          uploadedByUserId: context.actor.userId,
        });
        await stores.records.appendAudit({
          actorUserId: context.actor.userId,
          action: 'file.uploaded',
          entityType: 'file',
          entityId: file.id,
          after: { projectId: file.projectId, contentType: file.contentType, size: file.sizeBytes },
          requestId: context.requestId,
        });
        return file;
      });
    } catch (error) {
      // Do not leave orphaned bytes behind when the metadata could not be saved.
      await this.storage.deleteObject(key).catch(() => undefined);
      throw error;
    }
  }

  async attachToTask(context: RequestContext, taskId: string, fileId: string): Promise<void> {
    await this.deps.uow.transaction(async (stores) => {
      const loaded = await loadTaskForActor(stores, context.actor, taskId, false);
      if (!isParticipant(loaded.relation)) {
        throw new ForbiddenError('Only the owner, a collaborator or a manager can attach files.');
      }
      assertTaskOpen(loaded.task, 'attachments');
      await fileForProject(stores, context.actor, fileId, loaded.access, 'fileId');
      await stores.tasks.attachFile(taskId, fileId);
      await stores.records.appendActivity({
        projectId: loaded.task.projectId,
        taskId,
        actorUserId: context.actor.userId,
        type: 'task.file_attached',
        summary: `Attached a file to “${loaded.task.title}”.`,
        payload: { fileId },
      });
    });
  }

  /** The file to stream, if the actor may read it. Missing and forbidden both answer 404. */
  async authorizeDownload(actor: Actor, fileId: string): Promise<FileRecord> {
    return readableFile(this.deps.uow.stores, actor, fileId);
  }
}

export async function readableFile(
  stores: Pick<OperationsStores, 'deliverables' | 'access'>,
  actor: Actor,
  fileId: string,
): Promise<FileRecord> {
  const file = await stores.deliverables.findFile(fileId);
  if (!file) throw new NotFoundError('File');
  const access = file.projectId
    ? await new ProjectAccessService(stores.access).evaluate(actor, file.projectId)
    : null;
  if (!canReadFile(file, actor, access)) throw new NotFoundError('File');
  return file;
}
