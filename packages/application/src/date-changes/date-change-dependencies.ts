import { type NotificationKind, notificationDedupeKey } from '@lintel/domain';
import type { Clock } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { Notifier } from '../notifications/notifier';
import type { OperationsContext } from '../tasks/operations-context';
import type { DateChangeRequestRecord } from './date-change.store';

/** What new-date use cases are built with. */
export interface DateChangeDependencies {
  readonly uow: UnitOfWork<ApplicationStores>;
  readonly clock: Clock;
  readonly operations: OperationsContext;
}

/** One activity entry on the task and one audit row for a new-date step. */
export async function recordDateChangeStep(
  stores: Pick<ApplicationStores, 'records'>,
  context: RequestContext,
  request: DateChangeRequestRecord,
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
    payload: { dateChangeRequestId: request.id },
  });
  await stores.records.appendAudit({
    actorUserId: context.actor.userId,
    action: `task.${step.action}`,
    entityType: 'date_change_request',
    entityId: request.id,
    before: {
      status: request.status,
      startDate: request.previousStartDate,
      dueDate: request.previousDueDate,
    },
    after: { taskId: request.taskId, ...step.after },
    requestId: context.requestId,
  });
}

/** A new-date notice linking to the request on its task, sent once per person and step. */
export async function sendDateChangeNotice(
  notifier: Notifier,
  request: Pick<DateChangeRequestRecord, 'id' | 'taskId'>,
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
    linkPath: `/tasks/${request.taskId}?dateRequest=${request.id}`,
    subjectType: 'date_change_request',
    subjectId: request.id,
    dedupeKey: notificationDedupeKey({
      kind: notice.kind,
      recipientId: notice.recipientUserId,
      subjectId: request.id,
      window: notice.window,
    }),
    groupKey: `task:${request.taskId}`,
  });
}
