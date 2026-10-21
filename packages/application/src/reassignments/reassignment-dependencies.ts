import { type NotificationKind, notificationDedupeKey } from '@lintel/domain';
import type { Clock } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { Notifier } from '../notifications/notifier';
import type { OperationsContext } from '../tasks/operations-context';
import type { ReassignmentRequestRecord } from './reassignment.store';

/** What reassignment use cases are built with. */
export interface ReassignmentDependencies {
  readonly uow: UnitOfWork<ApplicationStores>;
  readonly clock: Clock;
  readonly operations: OperationsContext;
}

/** One activity entry on the task and one audit row for a reassignment step. */
export async function recordReassignmentStep(
  stores: Pick<ApplicationStores, 'records'>,
  context: RequestContext,
  request: ReassignmentRequestRecord,
  step: {
    readonly action: string;
    readonly summary: string;
    readonly after: Record<string, unknown>;
  },
): Promise<void> {
  await stores.records.appendActivity({
    projectId: request.projectId,
    taskId: request.taskId,
    actorUserId: context.actor.userId,
    type: `task.${step.action}`,
    summary: step.summary,
    payload: { reassignmentRequestId: request.id },
  });
  await stores.records.appendAudit({
    actorUserId: context.actor.userId,
    action: `task.${step.action}`,
    entityType: 'reassignment_request',
    entityId: request.id,
    before: { status: request.status },
    after: { taskId: request.taskId, ...step.after },
    requestId: context.requestId,
  });
}

/** A reassignment notice linking to the task, sent once per person and step. */
export async function sendReassignmentNotice(
  notifier: Notifier,
  request: Pick<ReassignmentRequestRecord, 'id' | 'taskId'>,
  notice: {
    readonly kind: NotificationKind;
    readonly recipientUserId: string;
    readonly title: string;
    readonly body: string;
    readonly window: string;
  },
): Promise<void> {
  await notifier.notify({
    recipientUserId: notice.recipientUserId,
    kind: notice.kind,
    title: notice.title,
    body: notice.body,
    linkPath: `/tasks/${request.taskId}`,
    subjectType: 'reassignment_request',
    subjectId: request.id,
    dedupeKey: notificationDedupeKey({
      kind: notice.kind,
      recipientId: notice.recipientUserId,
      subjectId: request.id,
      window: notice.window,
    }),
  });
}
