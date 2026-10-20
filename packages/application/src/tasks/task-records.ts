import { type NotificationKind, notificationDedupeKey } from '@lintel/domain';
import type { RecordStore } from '../common/record.store';
import type { RequestContext } from '../common/request-context';
import type { Notifier } from '../notifications/notifier';

export interface TaskChangeRecord {
  /** Activity type and audit action, e.g. "task.assigned". */
  readonly action: string;
  readonly summary: string;
  readonly before?: Record<string, unknown> | null;
  readonly after?: Record<string, unknown> | null;
}

/** Writes the activity feed entry and the audit row for one task change. */
export async function recordTaskChange(
  records: RecordStore,
  context: RequestContext,
  task: { readonly id: string; readonly projectId: string },
  change: TaskChangeRecord,
): Promise<void> {
  await records.appendActivity({
    projectId: task.projectId,
    taskId: task.id,
    actorUserId: context.actor.userId,
    type: change.action,
    summary: change.summary,
    payload: { ...(change.after ?? {}) },
  });
  await records.appendAudit({
    actorUserId: context.actor.userId,
    action: change.action,
    entityType: 'task',
    entityId: task.id,
    before: change.before ?? null,
    after: change.after ?? null,
    requestId: context.requestId,
  });
}

export interface TaskNotice {
  readonly kind: NotificationKind;
  readonly recipientUserId: string | null;
  readonly title: string;
  readonly body: string;
}

/**
 * Sends task notifications to everyone but the actor, once per person and
 * kind. `window` makes the dedupe key unique per change (e.g. the new version).
 */
export async function notifyAboutTask(
  notifier: Notifier,
  actorUserId: string,
  task: { readonly id: string },
  window: string,
  notices: readonly TaskNotice[],
): Promise<void> {
  const seen = new Set<string>();
  for (const notice of notices) {
    const recipient = notice.recipientUserId;
    if (!recipient || recipient === actorUserId) continue;
    const key = `${notice.kind}:${recipient}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await notifier.notify({
      recipientUserId: recipient,
      kind: notice.kind,
      title: notice.title,
      body: notice.body,
      linkPath: `/tasks/${task.id}`,
      subjectType: 'task',
      subjectId: task.id,
      dedupeKey: notificationDedupeKey({
        kind: notice.kind,
        recipientId: recipient,
        subjectId: task.id,
        window,
      }),
    });
  }
}

/** "Working drawings" with quotes, trimmed for notification text. */
export function quoted(title: string): string {
  return `“${title.length > 80 ? `${title.slice(0, 77)}…` : title}”`;
}
