import type { LeaveRequestFacts, NewNotification, PendingHandoverFact } from '@lintel/application';
import { type LeaveTaskConflict, notificationDedupeKey } from '@lintel/domain';
import { pluralize } from '@lintel/shared';
import { formatCalendarDate, summariseList } from './working-time';

function leavePeriod(leave: LeaveRequestFacts): string {
  const start = formatCalendarDate(leave.startDate);
  return leave.startDate === leave.endDate
    ? start
    : `${start} – ${formatCalendarDate(leave.endDate)}`;
}

/** Groups items by the manager who must act on them, keeping first-seen order. */
export function groupByManager<T>(
  items: readonly T[],
  managerOf: (item: T) => string | undefined,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const manager = managerOf(item);
    if (!manager) continue;
    groups.set(manager, [...(groups.get(manager) ?? []), item]);
  }
  return groups;
}

/** One `absence_reassessment` notification per affected project manager. */
export function absenceReassessmentNotification(
  leave: LeaveRequestFacts,
  managerUserId: string,
  conflicts: readonly LeaveTaskConflict[],
): NewNotification {
  const away = leave.isUrgentAbsence ? 'is absent' : 'is on approved leave';
  const titles = summariseList(conflicts.map((conflict) => `"${conflict.title}"`));
  const critical = conflicts.filter((conflict) => conflict.severity === 'critical').length;
  const criticalNote = critical > 0 ? ` ${critical} need attention first.` : '';
  return {
    recipientUserId: managerUserId,
    kind: 'absence_reassessment',
    title: `${leave.fullName} ${away}: ${pluralize(conflicts.length, 'task')} to reassess`,
    body: `${leave.fullName} ${away} (${leavePeriod(leave)}). Affected work: ${titles}.${criticalNote} Nothing has been reassigned.`,
    linkPath: `/leave/requests/${leave.id}`,
    subjectType: 'leave_request',
    subjectId: leave.id,
    dedupeKey: notificationDedupeKey({
      kind: 'absence_reassessment',
      recipientId: managerUserId,
      subjectId: leave.id,
    }),
    groupKey: `leave:${leave.id}`,
  };
}

/** The reminder on the working day before planned leave about handovers not yet applied. */
export function handoverReminderNotification(
  leave: LeaveRequestFacts,
  managerUserId: string,
  handovers: readonly PendingHandoverFact[],
): NewNotification {
  const titles = summariseList(handovers.map((handover) => `"${handover.title}"`));
  return {
    recipientUserId: managerUserId,
    kind: 'handover_requested',
    title: `Handovers before ${leave.fullName}'s leave: ${handovers.length} not applied`,
    body: `${leave.fullName} starts leave on ${formatCalendarDate(leave.startDate)}. Handovers not yet applied: ${titles}.`,
    linkPath: `/leave/requests/${leave.id}`,
    subjectType: 'leave_request',
    subjectId: leave.id,
    dedupeKey: notificationDedupeKey({
      kind: 'handover_requested',
      recipientId: managerUserId,
      subjectId: leave.id,
      window: `before:${leave.startDate}`,
    }),
    groupKey: `leave:${leave.id}`,
  };
}
