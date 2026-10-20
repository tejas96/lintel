import type { LeaveRequestFacts } from '@lintel/application';
import { detectLeaveConflicts, leaveDays } from '@lintel/domain';
import { zonedTimeToInstant } from '@lintel/shared';
import {
  type ActivityDependencies,
  calendarFor,
  notifyEach,
  withNotifier,
} from './activity-dependencies';
import {
  absenceReassessmentNotification,
  groupByManager,
  handoverReminderNotification,
} from './leave-messages';
import { delayUntil, previousWorkingDay } from './working-time';

export interface LeaveImpactResult {
  readonly status: 'notified' | 'inactive' | 'missing';
  readonly affectedTasks: number;
  readonly managersNotified: number;
  /** Planned leave only: wait before the handover reminder; null when there is none. */
  readonly handoverReminderDelayMs: number | null;
}

export type HandoverReminderResult = 'sent' | 'nothing_pending' | 'inactive';

/** Approved leave, or an urgent absence that was not withdrawn. */
function isActiveAbsence(leave: LeaveRequestFacts | null): leave is LeaveRequestFacts {
  if (!leave) return false;
  if (leave.isUrgentAbsence) return leave.status !== 'cancelled' && leave.status !== 'rejected';
  return leave.status === 'approved';
}

/** Activities of `leaveReassessmentWorkflow`. They inform managers and never reassign work. */
export function createLeaveActivities(deps: ActivityDependencies) {
  return {
    /**
     * Finds the absent person's open work affected by the absence (domain
     * conflict detection) and tells each affected project manager once.
     */
    async notifyLeaveImpact(leaveRequestId: string): Promise<LeaveImpactResult> {
      const settings = await deps.organization.settings();
      return withNotifier(deps, async (stores, notifier) => {
        const leave = await stores.background.leaveImpact.leaveRequest(leaveRequestId);
        if (!leave)
          return {
            status: 'missing',
            affectedTasks: 0,
            managersNotified: 0,
            handoverReminderDelayMs: null,
          };
        if (!isActiveAbsence(leave)) {
          return {
            status: 'inactive',
            affectedTasks: 0,
            managersNotified: 0,
            handoverReminderDelayMs: null,
          };
        }
        const calendar = await calendarFor(stores, leave.userId);
        const tasks = await stores.background.leaveImpact.openTasksOwnedBy(leave.userId);
        const days = leaveDays(leave, calendar);
        const report = detectLeaveConflicts(days, tasks, []);
        const managerOfTask = new Map(tasks.map((task) => [task.taskId, task.managerUserId]));
        const byManager = groupByManager(report.taskConflicts, (conflict) =>
          managerOfTask.get(conflict.taskId),
        );
        const notifications = [...byManager].map(([manager, conflicts]) =>
          absenceReassessmentNotification(leave, manager, conflicts),
        );
        await notifyEach(notifier, notifications);
        const now = deps.clock.now();
        const leaveStart = zonedTimeToInstant(
          leave.startDate,
          calendar.dayStartTime,
          calendar.timeZone,
        );
        const reminderAt = zonedTimeToInstant(
          previousWorkingDay(calendar, leave.startDate),
          settings.deadlineReminderTime,
          calendar.timeZone,
        );
        const plannedAhead = !leave.isUrgentAbsence && now.getTime() < leaveStart.getTime();
        return {
          status: 'notified',
          affectedTasks: report.taskConflicts.length,
          managersNotified: notifications.length,
          handoverReminderDelayMs: plannedAhead ? delayUntil(reminderAt, now) : null,
        };
      });
    },

    /** On the working day before planned leave: remind managers of handovers not yet applied. */
    async sendHandoverReminder(leaveRequestId: string): Promise<HandoverReminderResult> {
      return withNotifier(deps, async (stores, notifier) => {
        const leave = await stores.background.leaveImpact.leaveRequest(leaveRequestId);
        if (!isActiveAbsence(leave) || leave.isUrgentAbsence) return 'inactive';
        const pending = await stores.background.leaveImpact.handoversNotApplied(leaveRequestId);
        if (pending.length === 0) return 'nothing_pending';
        const byManager = groupByManager(pending, (handover) => handover.managerUserId);
        await notifyEach(
          notifier,
          [...byManager].map(([manager, handovers]) =>
            handoverReminderNotification(leave, manager, handovers),
          ),
        );
        return 'sent';
      });
    },
  };
}
