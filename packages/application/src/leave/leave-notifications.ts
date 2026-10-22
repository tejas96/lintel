import { type NotificationKind, notificationDedupeKey } from '@lintel/domain';
import type { NewNotification } from '../notifications/notification.store';

export interface LeaveSummaryFacts {
  readonly requestId: string;
  readonly personName: string;
  readonly leaveTypeName: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly durationLabel: string;
}

const leavePath = (requestId: string) => `/leave/${requestId}`;

function datesOf(facts: LeaveSummaryFacts): string {
  return facts.startDate === facts.endDate
    ? facts.startDate
    : `${facts.startDate} to ${facts.endDate}`;
}

function build(
  kind: NotificationKind,
  recipientUserId: string,
  subjectId: string,
  window: string,
  content: { title: string; body: string; linkPath: string; subjectType: string },
): NewNotification {
  return {
    recipientUserId,
    kind,
    ...content,
    subjectId,
    dedupeKey: notificationDedupeKey({ kind, recipientId: recipientUserId, subjectId, window }),
  };
}

/** Asks an approver to decide. `window` separates level 1, level 2 and re-submissions. */
export function leaveRequestedNotification(
  approverUserId: string,
  facts: LeaveSummaryFacts,
  window: string,
): NewNotification {
  return build('leave_requested', approverUserId, facts.requestId, window, {
    title: `${facts.personName} requested ${facts.leaveTypeName.toLowerCase()}`,
    body: `${datesOf(facts)} · ${facts.durationLabel}. Review the impact and decide.`,
    linkPath: leavePath(facts.requestId),
    subjectType: 'leave_request',
  });
}

const OUTCOME_TEXT: Readonly<Record<string, string>> = {
  approved: 'was approved',
  rejected: 'was not approved',
  cancelled: 'was cancelled',
};

/** Tells the person what happened to their request. */
export function leaveDecidedNotification(
  requesterUserId: string,
  facts: LeaveSummaryFacts,
  status: string,
  note: string | null,
  version: number,
): NewNotification {
  const outcome = OUTCOME_TEXT[status] ?? `is now ${status}`;
  return build('leave_decided', requesterUserId, facts.requestId, `v${version}`, {
    title: `Your ${facts.leaveTypeName.toLowerCase()} ${outcome}`,
    body: note ? `${datesOf(facts)}. Note: ${note}` : datesOf(facts),
    linkPath: leavePath(facts.requestId),
    subjectType: 'leave_request',
  });
}

export function leaveInfoRequestedNotification(
  requesterUserId: string,
  facts: LeaveSummaryFacts,
  note: string | null,
  version: number,
): NewNotification {
  return build('leave_info_requested', requesterUserId, facts.requestId, `v${version}`, {
    title: 'More information needed for your leave request',
    body: note ?? 'Your approver asked for more details.',
    linkPath: leavePath(facts.requestId),
    subjectType: 'leave_request',
  });
}

export function handoverRequestedNotification(
  recipientUserId: string,
  facts: LeaveSummaryFacts,
  taskId: string,
  taskTitle: string,
): NewNotification {
  return build('handover_requested', recipientUserId, taskId, facts.requestId, {
    title: `${facts.personName} proposed you cover "${taskTitle}"`,
    body: `During ${datesOf(facts)}. Accept or decline the handover.`,
    linkPath: leavePath(facts.requestId),
    subjectType: 'leave_request',
  });
}

/** Urgent absence: the project manager re-plans the listed work; nothing is reassigned. */
export function absenceReassessmentNotification(
  managerUserId: string,
  facts: LeaveSummaryFacts,
  taskTitles: readonly string[],
): NewNotification {
  const listed = taskTitles.slice(0, 5).map((title) => `"${title}"`);
  const more = taskTitles.length > 5 ? ` and ${taskTitles.length - 5} more` : '';
  return build('absence_reassessment', managerUserId, facts.requestId, 'once', {
    title: `${facts.personName} is unexpectedly absent`,
    body: `${datesOf(facts)}. Affected work: ${listed.join(', ')}${more}. Nothing was reassigned automatically.`,
    linkPath: leavePath(facts.requestId),
    subjectType: 'leave_request',
  });
}

export function taskHandoverNotifications(input: {
  readonly taskId: string;
  readonly taskTitle: string;
  readonly handoverId: string;
  readonly previousOwnerUserId: string | null;
  readonly newOwnerUserId: string;
  /** Separates a second application after the task was handed back. */
  readonly window?: string;
}): NewNotification[] {
  const window = input.window ?? input.handoverId;
  const linkPath = `/tasks/${input.taskId}`;
  const notifications = [
    build('task_assigned', input.newOwnerUserId, input.taskId, window, {
      title: `You now own "${input.taskTitle}"`,
      body: 'This task was handed over to you for a leave period.',
      linkPath,
      subjectType: 'task',
    }),
  ];
  if (input.previousOwnerUserId && input.previousOwnerUserId !== input.newOwnerUserId) {
    notifications.push(
      build('task_reassigned', input.previousOwnerUserId, input.taskId, window, {
        title: `"${input.taskTitle}" was handed over`,
        body: 'Your manager applied the handover you proposed.',
        linkPath,
        subjectType: 'task',
      }),
    );
  }
  return notifications;
}
