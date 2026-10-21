import type { FollowUpStore, TaskDeadlineFacts } from '@lintel/application';
import {
  type EscalationStep,
  isOpenTaskStatus,
  planDeadlineEscalation,
  planLateStartNudge,
} from '@lintel/domain';
import {
  type ActivityDependencies,
  calendarFor,
  notifyEach,
  uniqueRecipients,
  withNotifier,
} from './activity-dependencies';
import { deadlineNotification } from './deadline-messages';
import {
  type DeadlinePlan,
  type DeadlineStepRef,
  plannedStartOfStep,
  toDeadlinePlanSteps,
} from './deadline-plan';

/** `not_needed`: a late-start nudge whose task started (or cannot start) meanwhile. */
export type DeadlineStepResult =
  | 'sent'
  | 'no_recipient'
  | 'not_needed'
  | 'task_closed'
  | 'due_date_changed';

function isStillOpen(task: TaskDeadlineFacts): boolean {
  return !task.archived && isOpenTaskStatus(task.status);
}

async function recipientsFor(
  followUps: FollowUpStore,
  task: TaskDeadlineFacts,
  step: DeadlineStepRef,
): Promise<string[]> {
  switch (step.audience) {
    case 'task_owner':
      return uniqueRecipients([task.ownerUserId]);
    case 'project_manager':
      return uniqueRecipients([task.project.managerUserId]);
    case 'business_owner':
      return uniqueRecipients(
        await followUps.activeUserIdsWithCapability('dashboard.view_business'),
      );
  }
}

/**
 * A late-start nudge is re-checked right before it goes out: a moved start
 * re-plans (like a moved due date); work that started, or can no longer
 * start, needs no nudge.
 */
function lateStartCheck(
  task: TaskDeadlineFacts,
  step: DeadlineStepRef,
): 'due_date_changed' | 'not_needed' | null {
  const plannedStart = plannedStartOfStep(step.key);
  if (step.kind !== 'task_late_start') return null;
  if (plannedStart !== task.plannedStartDate) return 'due_date_changed';
  if (task.status !== 'ready' || !task.prerequisitesDone) return 'not_needed';
  return null;
}

/** Activities of `taskDeadlineWorkflow`. Both are read-mostly and safe to retry. */
export function createDeadlineActivities(deps: ActivityDependencies) {
  return {
    /**
     * The reminder/escalation timeline for the task's current due date,
     * computed with the domain policy (owner's calendar, studio reminder
     * time, project criticality, template escalation delay).
     */
    async loadDeadlinePlan(taskId: string): Promise<DeadlinePlan> {
      const stores = deps.uow.stores;
      const task = await stores.background.followUps.taskDeadline(taskId);
      if (!task) return { open: false, dueDate: null, steps: [] };
      if (!isStillOpen(task)) return { open: false, dueDate: task.dueDate, steps: [] };
      if (task.dueDate === null) return { open: true, dueDate: null, steps: [] };
      const [settings, calendar] = await Promise.all([
        deps.organization.settings(),
        calendarFor(stores, task.ownerUserId),
      ]);
      const steps: EscalationStep[] = planDeadlineEscalation({
        dueDate: task.dueDate,
        priority: task.priority,
        projectCriticality: task.project.criticality,
        escalateAfterOverdueDays: task.escalateAfterOverdueDays,
        calendar,
        reminderTime: settings.deadlineReminderTime,
      });
      const nudge = planLateStartNudge({
        ...task,
        calendar,
        reminderTime: settings.deadlineReminderTime,
      });
      if (nudge) {
        steps.push({
          at: nudge.at,
          audience: 'task_owner',
          kind: 'task_late_start',
          label: 'Late-start nudge the working day after the planned start',
        });
      }
      return {
        open: true,
        dueDate: task.dueDate,
        steps: toDeadlinePlanSteps(steps, deps.clock.now(), nudge?.plannedStartDate ?? null),
      };
    },

    /**
     * Re-checks that the task is still open with the same due date, then
     * notifies the step's audience in the same transaction.
     */
    async sendDeadlineStep(
      taskId: string,
      dueDate: string,
      step: DeadlineStepRef,
    ): Promise<DeadlineStepResult> {
      return withNotifier(deps, async (stores, notifier) => {
        const followUps = stores.background.followUps;
        const task = await followUps.taskDeadline(taskId);
        if (!task || !isStillOpen(task)) return 'task_closed';
        if (task.dueDate !== dueDate) return 'due_date_changed';
        const lateStart = lateStartCheck(task, step);
        if (lateStart) return lateStart;
        const recipients = await recipientsFor(followUps, task, step);
        if (recipients.length === 0) return 'no_recipient';
        await notifyEach(
          notifier,
          recipients.map((recipient) => deadlineNotification(task, dueDate, step, recipient)),
        );
        deps.logger.info('Deadline step sent', {
          taskId,
          step: step.key,
          recipients: recipients.length,
        });
        return 'sent';
      });
    },
  };
}
