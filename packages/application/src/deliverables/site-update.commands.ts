import { type Actor, notificationDedupeKey } from '@lintel/domain';
import { ForbiddenError, ValidationFailedError } from '@lintel/shared';
import { type ProjectAccess, ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { Notifier } from '../notifications/notifier';
import type { OperationsDependencies, OperationsStores } from '../tasks/operations-context';
import { isImageContentType } from './file-rules';

export interface CreateSiteUpdateInput {
  readonly taskId: string | null;
  readonly note: string;
  readonly hasIssue: boolean;
  readonly photoFileIds: readonly string[];
}

function assertMayPost(actor: Actor, access: ProjectAccess): void {
  if (!actor.capabilities.has('site_updates.create')) {
    throw new ForbiddenError('Your role cannot post site updates.');
  }
  if (access.projectRole === null && access.managerUserId !== actor.userId) {
    throw new ForbiddenError('Only members of this project can post site updates.');
  }
}

/** Photos must be available images the author uploaded, unscoped or already in this project. */
async function claimPhotos(
  stores: Pick<OperationsStores, 'deliverables'>,
  actor: Actor,
  projectId: string,
  fileIds: readonly string[],
): Promise<string[]> {
  const photoIds = [...new Set(fileIds)];
  for (const fileId of photoIds) {
    const file = await stores.deliverables.findFile(fileId);
    const usable =
      file?.status === 'available' &&
      file.uploadedByUserId === actor.userId &&
      isImageContentType(file.contentType) &&
      (file.projectId === null || file.projectId === projectId);
    if (!file || !usable) {
      throw new ValidationFailedError('Photos must be images you uploaded for this project.', [
        { field: 'photoFileIds', message: 'One of the photos cannot be used.' },
      ]);
    }
    if (file.projectId === null) await stores.deliverables.claimFileForProject(fileId, projectId);
  }
  return photoIds;
}

async function alertManager(
  notifier: Notifier,
  managerUserId: string,
  projectId: string,
  update: { id: string; note: string },
): Promise<void> {
  await notifier.notify({
    recipientUserId: managerUserId,
    kind: 'project_at_risk',
    title: 'Issue reported from site',
    body: update.note.length > 200 ? `${update.note.slice(0, 197)}…` : update.note,
    linkPath: `/projects/${projectId}/site-updates`,
    subjectType: 'site_update',
    subjectId: update.id,
    dedupeKey: notificationDedupeKey({
      kind: 'project_at_risk',
      recipientId: managerUserId,
      subjectId: update.id,
    }),
  });
}

/** Progress notes and photos from site. Issues alert the project manager. */
export class SiteUpdateCommands {
  constructor(private readonly deps: OperationsDependencies) {}

  async create(
    context: RequestContext,
    projectId: string,
    input: CreateSiteUpdateInput,
  ): Promise<{ id: string }> {
    const actor = context.actor;
    return this.deps.uow.transaction(async (stores) => {
      const access = await new ProjectAccessService(stores.access).requireView(actor, projectId);
      assertMayPost(actor, access);
      if (input.taskId) {
        const refs = await stores.tasks.referencesInProject(projectId, { taskId: input.taskId });
        if (!refs.task) {
          throw new ValidationFailedError('Choose a task of this project.', [
            { field: 'taskId', message: 'This task is not part of the project.' },
          ]);
        }
      }
      const photoIds = await claimPhotos(stores, actor, projectId, input.photoFileIds);
      const update = await stores.deliverables.createSiteUpdate({
        projectId,
        taskId: input.taskId,
        authorUserId: actor.userId,
        note: input.note,
        hasIssue: input.hasIssue,
        photoFileIds: photoIds,
      });
      await stores.records.appendActivity({
        projectId,
        taskId: input.taskId,
        actorUserId: actor.userId,
        type: input.hasIssue ? 'site_update.issue_reported' : 'site_update.posted',
        summary: input.hasIssue ? 'Reported an issue from site.' : 'Posted a site update.',
        payload: { siteUpdateId: update.id, photoCount: photoIds.length },
      });
      const manager = access.managerUserId;
      if (input.hasIssue && manager && manager !== actor.userId) {
        const notifier = await this.deps.context.notifierFor(stores);
        await alertManager(notifier, manager, projectId, { id: update.id, note: input.note });
      }
      return update;
    });
  }
}
