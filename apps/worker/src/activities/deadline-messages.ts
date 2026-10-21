import type { NewNotification, TaskDeadlineFacts } from '@lintel/application';
import { notificationDedupeKey, TASK_STATUS_LABELS } from '@lintel/domain';
import type { DeadlineStepRef } from './deadline-plan';
import { formatCalendarDate } from './working-time';

interface MessageText {
  readonly title: string;
  readonly body: string;
}

function textFor(task: TaskDeadlineFacts, step: DeadlineStepRef, due: string): MessageText {
  const project = task.project.name;
  const owner = task.ownerName ?? 'no owner';
  const status = TASK_STATUS_LABELS[task.status].toLowerCase();
  if (step.kind === 'task_late_start') {
    const start = task.plannedStartDate ? formatCalendarDate(task.plannedStartDate) : 'its start';
    return {
      title: `Not started yet: ${task.title}`,
      body: `"${task.title}" (${project}) was planned to start on ${start}. Start it, report a blocker, or ask for a new date.`,
    };
  }
  if (step.kind === 'deadline_upcoming') {
    return {
      title: `Due ${due}: ${task.title}`,
      body: `"${task.title}" (${project}) is due on ${due}.`,
    };
  }
  if (step.audience === 'task_owner') {
    return {
      title: `Overdue: ${task.title}`,
      body: `"${task.title}" (${project}) was due on ${due}. Update its status or agree a new date with your manager.`,
    };
  }
  if (step.audience === 'project_manager') {
    return {
      title: `Overdue in ${project}: ${task.title}`,
      body: `"${task.title}" (${owner}) was due on ${due} and is still ${status}.`,
    };
  }
  return {
    title: `Critical work overdue: ${task.title}`,
    body: `"${task.title}" in ${project} (${owner}) was due on ${due} and is still ${status}.`,
  };
}

/**
 * The notification for one deadline step. The dedupe key includes the step
 * and the due date, so a retried activity never notifies twice, while a new
 * due date starts a fresh timeline.
 */
export function deadlineNotification(
  task: TaskDeadlineFacts,
  dueDate: string,
  step: DeadlineStepRef,
  recipientUserId: string,
): NewNotification {
  const { title, body } = textFor(task, step, formatCalendarDate(dueDate));
  return {
    recipientUserId,
    kind: step.kind,
    title,
    body,
    linkPath:
      step.kind === 'task_late_start'
        ? `/tasks/${task.taskId}?nudge=late-start`
        : `/tasks/${task.taskId}`,
    subjectType: 'task',
    subjectId: task.taskId,
    dedupeKey: notificationDedupeKey({
      kind: step.kind,
      recipientId: recipientUserId,
      subjectId: task.taskId,
      window: `${dueDate}:${step.key}`,
    }),
    groupKey: `task:${task.taskId}`,
  };
}
