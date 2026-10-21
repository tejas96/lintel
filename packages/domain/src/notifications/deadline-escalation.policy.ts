import { type CalendarDate, zonedTimeToInstant } from '@lintel/shared';
import { addWorkingDays, type WorkingCalendar } from '../calendar/working-calendar';
import { previousWorkingDay } from '../calendar/working-moments';
import type { ProjectCriticality } from '../projects/project-status';
import type { TaskPriority } from '../tasks/task-status';
import type { NotificationKind } from './notification-kinds';

export type EscalationAudience = 'task_owner' | 'project_manager' | 'business_owner';

/** Working days overdue before the project manager hears; 0 behaves like 1 (the next working day). */
export const ESCALATION_DELAY_LIMITS = { minimum: 1, maximum: 30 } as const;

export function validateEscalationDelay(workingDays: number): string | null {
  const { minimum, maximum } = ESCALATION_DELAY_LIMITS;
  return Number.isInteger(workingDays) && workingDays >= minimum && workingDays <= maximum
    ? null
    : `Use a whole number of working days from ${minimum} to ${maximum}.`;
}

export interface EscalationStep {
  readonly at: Date;
  readonly audience: EscalationAudience;
  readonly kind: NotificationKind;
  readonly label: string;
}

export interface DeadlineEscalationInput {
  readonly dueDate: CalendarDate;
  readonly priority: TaskPriority;
  readonly projectCriticality: ProjectCriticality;
  /** From the template; how many working days overdue before the manager hears. */
  readonly escalateAfterOverdueDays: number;
  readonly calendar: WorkingCalendar;
  /** "HH:mm" reminder time on the working day before the due date. */
  readonly reminderTime: string;
}

/**
 * The reminder and escalation timeline for a task deadline. The Temporal
 * workflow sleeps until each step and checks the task again before sending.
 */
export function planDeadlineEscalation(input: DeadlineEscalationInput): EscalationStep[] {
  const { calendar } = input;
  const zone = calendar.timeZone;
  const dayBefore = previousWorkingDay(calendar, input.dueDate);
  const steps: EscalationStep[] = [
    {
      at: zonedTimeToInstant(dayBefore, input.reminderTime, zone),
      audience: 'task_owner',
      kind: 'deadline_upcoming',
      label: 'Reminder on the working day before the deadline',
    },
    {
      at: zonedTimeToInstant(input.dueDate, calendar.dayEndTime, zone),
      audience: 'task_owner',
      kind: 'task_overdue',
      label: 'Overdue at the end of the due day',
    },
  ];
  const managerDay = addWorkingDays(
    calendar,
    input.dueDate,
    Math.max(1, input.escalateAfterOverdueDays),
  );
  steps.push({
    at: zonedTimeToInstant(managerDay, calendar.dayStartTime, zone),
    audience: 'project_manager',
    kind: 'task_overdue_escalated',
    label: 'Project manager alerted',
  });
  if (input.priority === 'urgent' || input.projectCriticality === 'critical') {
    steps.push({
      at: zonedTimeToInstant(addWorkingDays(calendar, managerDay, 2), calendar.dayStartTime, zone),
      audience: 'business_owner',
      kind: 'task_overdue_escalated',
      label: 'Owner alerted for critical work',
    });
  }
  return steps.sort((left, right) => left.at.getTime() - right.at.getTime());
}
