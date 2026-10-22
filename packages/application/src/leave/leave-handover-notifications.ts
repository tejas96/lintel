import { notificationDedupeKey } from '@lintel/domain';
import type { NewNotification } from '../notifications/notification.store';
import type { LeaveHandoverRecord, NewHandover } from './leave.store';
import { handoverRequestedNotification, type LeaveSummaryFacts } from './leave-notifications';

/**
 * Asks each proposed colleague to accept or decline covering a task (on a new
 * request and again when the requester revises the proposals). Dedupe keys
 * are per task and request, so a resubmission does not ask twice.
 */
export function handoverRequestNotifications(
  facts: LeaveSummaryFacts,
  handovers: readonly Pick<NewHandover, 'taskId' | 'toUserId'>[],
  tasks: readonly { readonly taskId: string; readonly title: string }[],
  requesterUserId: string,
): NewNotification[] {
  return handovers.flatMap((handover) => {
    const task = tasks.find((candidate) => candidate.taskId === handover.taskId);
    if (!handover.toUserId || !task || handover.toUserId === requesterUserId) return [];
    return [handoverRequestedNotification(handover.toUserId, facts, task.taskId, task.title)];
  });
}

/**
 * Once leave is approved, each project manager with handovers still to apply
 * hears which tasks to hand over (one notification per manager and request).
 * The work also waits in their approvals until it is handed over.
 */
export function handoverToApplyNotifications(
  facts: LeaveSummaryFacts,
  handovers: readonly LeaveHandoverRecord[],
  requesterUserId: string,
): NewNotification[] {
  const byManager = new Map<string, string[]>();
  for (const handover of handovers) {
    if (handover.status === 'applied') continue;
    const managerId = handover.projectManagerUserId;
    if (managerId === requesterUserId) continue;
    byManager.set(managerId, [...(byManager.get(managerId) ?? []), handover.taskTitle]);
  }
  const dates =
    facts.startDate === facts.endDate ? facts.startDate : `${facts.startDate} to ${facts.endDate}`;
  return [...byManager.entries()].map(([managerId, titles]) => {
    const listed = titles.slice(0, 5).map((title) => `"${title}"`);
    const more = titles.length > 5 ? ` and ${titles.length - 5} more` : '';
    return {
      recipientUserId: managerId,
      kind: 'handover_requested',
      title: `Hand over ${facts.personName}'s work while they are away`,
      body: `${dates}. Choose who covers ${listed.join(', ')}${more}.`,
      linkPath: `/leave/${facts.requestId}`,
      subjectType: 'leave_request',
      subjectId: facts.requestId,
      dedupeKey: notificationDedupeKey({
        kind: 'handover_requested',
        recipientId: managerId,
        subjectId: facts.requestId,
        window: 'apply',
      }),
    };
  });
}
