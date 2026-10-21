import { type CalendarDate, calendarDateInTimeZone } from '@lintel/shared';
import type { WorkingCalendar } from '../calendar/working-calendar';
import { planDeadlineEscalation } from '../notifications/deadline-escalation.policy';
import { planBlockerFollowUp } from '../notifications/follow-up-escalation.policy';
import type { ProjectCriticality } from '../projects/project-status';
import type { TaskPriority } from '../tasks/task-status';

export interface OverdueTaskFact {
  readonly taskId: string;
  readonly title: string;
  readonly projectId: string;
  readonly dueDate: CalendarDate;
  readonly priority: TaskPriority;
  readonly projectCriticality: ProjectCriticality;
  readonly escalateAfterOverdueDays: number;
}

export interface OpenBlockerFact {
  readonly blockerId: string;
  readonly taskId: string;
  readonly title: string;
  readonly projectId: string;
  readonly raisedAt: Date;
  readonly reason: string;
}

export interface OwnerIntervention {
  readonly kind: 'overdue_escalated' | 'blocker_escalated';
  /** The task, or the blocker for a blocker escalation. */
  readonly subjectId: string;
  readonly taskId: string;
  readonly title: string;
  readonly projectId: string;
  readonly escalatedAt: Date;
  readonly summary: string;
}

export interface InterventionContext {
  readonly calendar: WorkingCalendar;
  readonly reminderTime: string;
  readonly now: Date;
}

/**
 * Owner intervention needed = something Lintel has already escalated to the
 * business owner that is still unresolved. The moments are the same ones the
 * worker uses: an urgent task or one on a critical project two working days
 * after the project manager's overdue alert, and a blocker open for three
 * working days. Oldest escalation first.
 */
export function ownerInterventions(
  overdue: readonly OverdueTaskFact[],
  blockers: readonly OpenBlockerFact[],
  context: InterventionContext,
): OwnerIntervention[] {
  const zone = context.calendar.timeZone;
  const now = context.now.getTime();
  const items: OwnerIntervention[] = [];
  for (const task of overdue) {
    const ownerStep = planDeadlineEscalation({
      dueDate: task.dueDate,
      priority: task.priority,
      projectCriticality: task.projectCriticality,
      escalateAfterOverdueDays: task.escalateAfterOverdueDays,
      calendar: context.calendar,
      reminderTime: context.reminderTime,
    }).find((step) => step.audience === 'business_owner');
    if (!ownerStep || ownerStep.at.getTime() > now) continue;
    items.push({
      kind: 'overdue_escalated',
      subjectId: task.taskId,
      taskId: task.taskId,
      title: task.title,
      projectId: task.projectId,
      escalatedAt: ownerStep.at,
      summary: `"${task.title}" was due ${task.dueDate}; escalated to the owner on ${calendarDateInTimeZone(ownerStep.at, zone)}.`,
    });
  }
  for (const blocker of blockers) {
    const ownerStep = planBlockerFollowUp(context.calendar, blocker.raisedAt).find(
      (step) => step.audience === 'business_owner',
    );
    if (!ownerStep || ownerStep.at.getTime() > now) continue;
    items.push({
      kind: 'blocker_escalated',
      subjectId: blocker.blockerId,
      taskId: blocker.taskId,
      title: blocker.title,
      projectId: blocker.projectId,
      escalatedAt: ownerStep.at,
      summary: `"${blocker.title}" has been blocked since ${calendarDateInTimeZone(blocker.raisedAt, zone)}: ${blocker.reason}`,
    });
  }
  return items.sort((left, right) => left.escalatedAt.getTime() - right.escalatedAt.getTime());
}
