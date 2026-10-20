import { domainEvent, type NotificationKind, notificationDedupeKey } from '@lintel/domain';
import { ForbiddenError, StaleVersionError, ValidationFailedError } from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { Notifier } from '../notifications/notifier';
import type { OperationsDependencies, OperationsStores } from '../tasks/operations-context';
import { assertActivePeople } from '../tasks/task-validation';
import type { DeliverableRecord, NewDeliverable } from './deliverable.store';
import {
  assertSubmittable,
  loadDeliverableForActor,
  maySubmitDeliverable,
} from './deliverable-access';
import { fileForProject } from './file-rules';

export async function notifyAboutDeliverable(
  notifier: Notifier,
  actorUserId: string,
  deliverable: Pick<DeliverableRecord, 'id'>,
  notice: { kind: NotificationKind; recipientUserId: string | null; title: string; body: string },
  window: string,
): Promise<void> {
  const recipient = notice.recipientUserId;
  if (!recipient || recipient === actorUserId) return;
  await notifier.notify({
    recipientUserId: recipient,
    kind: notice.kind,
    title: notice.title,
    body: notice.body,
    linkPath: `/deliverables/${deliverable.id}`,
    subjectType: 'deliverable',
    subjectId: deliverable.id,
    dedupeKey: notificationDedupeKey({
      kind: notice.kind,
      recipientId: recipient,
      subjectId: deliverable.id,
      window,
    }),
  });
}

export async function recordDeliverableChange(
  stores: Pick<OperationsStores, 'records'>,
  context: RequestContext,
  deliverable: Pick<DeliverableRecord, 'id' | 'projectId' | 'taskId'>,
  change: { action: string; summary: string; after: Record<string, unknown> },
): Promise<void> {
  await stores.records.appendActivity({
    projectId: deliverable.projectId,
    taskId: deliverable.taskId,
    actorUserId: context.actor.userId,
    type: change.action,
    summary: change.summary,
    payload: { deliverableId: deliverable.id, ...change.after },
  });
  await stores.records.appendAudit({
    actorUserId: context.actor.userId,
    action: change.action,
    entityType: 'deliverable',
    entityId: deliverable.id,
    after: change.after,
    requestId: context.requestId,
  });
}

/** Creating deliverables and submitting versions for review. */
export class DeliverableCommands {
  constructor(private readonly deps: OperationsDependencies) {}

  async create(context: RequestContext, input: NewDeliverable): Promise<DeliverableRecord> {
    return this.deps.uow.transaction(async (stores) => {
      await new ProjectAccessService(stores.access).requireManage(context.actor, input.projectId);
      if (input.taskId) {
        const refs = await stores.tasks.referencesInProject(input.projectId, {
          taskId: input.taskId,
        });
        if (!refs.task) {
          throw new ValidationFailedError('Choose a task of this project.', [
            { field: 'taskId', message: 'This task is not part of the project.' },
          ]);
        }
      }
      await assertActivePeople(stores, [{ field: 'reviewerUserId', userId: input.reviewerUserId }]);
      if (input.reviewerUserId) {
        await stores.tasks.ensureProjectMember(input.projectId, input.reviewerUserId);
      }
      const deliverable = await stores.deliverables.createDeliverable(input);
      await recordDeliverableChange(stores, context, deliverable, {
        action: 'deliverable.created',
        summary: `Added the deliverable “${deliverable.name}”.`,
        after: { name: deliverable.name, isRequired: deliverable.isRequired },
      });
      return deliverable;
    });
  }

  async submitVersion(
    context: RequestContext,
    deliverableId: string,
    input: { fileId: string; note: string | null; version: number },
  ): Promise<DeliverableRecord> {
    const actor = context.actor;
    return this.deps.uow.transaction(async (stores) => {
      const { deliverable, access } = await loadDeliverableForActor(
        stores,
        actor,
        deliverableId,
        true,
      );
      if (!(await maySubmitDeliverable(stores, actor, deliverable, access))) {
        throw new ForbiddenError(
          'Only the people working on this task or the project manager can submit versions.',
        );
      }
      if (deliverable.version !== input.version) throw new StaleVersionError('This deliverable');
      assertSubmittable(deliverable.status);
      await fileForProject(stores, actor, input.fileId, access, 'fileId');
      const versionNumber = deliverable.currentVersionNumber + 1;
      const version = await stores.deliverables.addVersion({
        deliverableId,
        versionNumber,
        fileId: input.fileId,
        note: input.note,
        submittedByUserId: actor.userId,
      });
      const after = await stores.deliverables.updateDeliverable(deliverableId, input.version, {
        status: 'in_review',
        currentVersionNumber: versionNumber,
      });
      if (!after) throw new StaleVersionError('This deliverable');
      await recordDeliverableChange(stores, context, after, {
        action: 'deliverable.version_submitted',
        summary: `Submitted version ${versionNumber} of “${after.name}” for review.`,
        after: { versionId: version.id, versionNumber, fileId: input.fileId },
      });
      await stores.records.enqueueEvent(
        domainEvent('DeliverableSubmitted', 'deliverable', after.id, {
          deliverableId: after.id,
          versionId: version.id,
          projectId: after.projectId,
        }),
      );
      const notifier = await this.deps.context.notifierFor(stores);
      await notifyAboutDeliverable(
        notifier,
        actor.userId,
        after,
        {
          kind: 'review_requested',
          recipientUserId: after.reviewerUserId ?? access.managerUserId,
          title: `Review requested: “${after.name}”`,
          body: `Version ${versionNumber} is waiting for your decision.`,
        },
        `v${versionNumber}`,
      );
      return after;
    });
  }
}
