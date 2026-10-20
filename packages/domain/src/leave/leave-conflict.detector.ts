import { type CalendarDate, rangesOverlap } from '@lintel/shared';
import type { ProjectCriticality } from '../projects/project-status';
import type { TaskPriority, TaskStatus } from '../tasks/task-status';
import { isOpenTaskStatus } from '../tasks/task-status';
import type { LeaveDay } from './leave-request';

export interface LeaveTaskFact {
  readonly taskId: string;
  readonly title: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly projectCriticality: ProjectCriticality;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly plannedStartDate: CalendarDate | null;
  readonly dueDate: CalendarDate | null;
  readonly milestoneName: string | null;
  readonly milestoneDueDate: CalendarDate | null;
}

export interface TeamAbsenceFact {
  readonly userId: string;
  readonly fullName: string;
  readonly status: 'pending' | 'approved';
  readonly dates: readonly CalendarDate[];
}

export type LeaveConflictKind = 'due_during_leave' | 'work_during_leave' | 'milestone_during_leave';

export interface LeaveTaskConflict {
  readonly taskId: string;
  readonly title: string;
  readonly projectName: string;
  readonly kind: LeaveConflictKind;
  readonly severity: 'critical' | 'warning';
  readonly explanation: string;
}

export interface LeaveConflictReport {
  readonly taskConflicts: readonly LeaveTaskConflict[];
  readonly overlappingAbsences: readonly {
    userId: string;
    fullName: string;
    status: string;
    dates: CalendarDate[];
  }[];
  readonly hasCritical: boolean;
}

function classify(
  task: LeaveTaskFact,
  start: CalendarDate,
  end: CalendarDate,
): LeaveConflictKind | null {
  const inside = (date: CalendarDate | null) => date !== null && date >= start && date <= end;
  if (inside(task.milestoneDueDate)) return 'milestone_during_leave';
  if (inside(task.dueDate)) return 'due_during_leave';
  if (task.plannedStartDate && task.dueDate) {
    const window = { start: task.plannedStartDate, end: task.dueDate };
    if (rangesOverlap(window, { start, end })) return 'work_during_leave';
  }
  return null;
}

function severityOf(task: LeaveTaskFact, kind: LeaveConflictKind): 'critical' | 'warning' {
  if (kind === 'milestone_during_leave') return 'critical';
  if (task.projectCriticality === 'critical') return 'critical';
  if (kind === 'due_during_leave' && (task.priority === 'urgent' || task.priority === 'high')) {
    return 'critical';
  }
  return 'warning';
}

const EXPLANATIONS: Readonly<Record<LeaveConflictKind, (task: LeaveTaskFact) => string>> = {
  milestone_during_leave: (task) =>
    `Milestone "${task.milestoneName ?? 'milestone'}" is due during the leave.`,
  due_during_leave: (task) => `"${task.title}" is due on ${task.dueDate ?? 'a leave day'}.`,
  work_during_leave: (task) => `"${task.title}" is scheduled to be worked on during the leave.`,
};

/**
 * Finds work affected by a leave request. Conflicts inform the decision; they
 * never reject leave on their own.
 */
export function detectLeaveConflicts(
  days: readonly LeaveDay[],
  tasks: readonly LeaveTaskFact[],
  teamAbsences: readonly TeamAbsenceFact[],
): LeaveConflictReport {
  const dates = days.map((day) => day.date).sort();
  const start = dates[0];
  const end = dates[dates.length - 1];
  if (start === undefined || end === undefined) {
    return { taskConflicts: [], overlappingAbsences: [], hasCritical: false };
  }
  const taskConflicts: LeaveTaskConflict[] = [];
  for (const task of tasks.filter((candidate) => isOpenTaskStatus(candidate.status))) {
    const kind = classify(task, start, end);
    if (kind === null) continue;
    taskConflicts.push({
      taskId: task.taskId,
      title: task.title,
      projectName: task.projectName,
      kind,
      severity: severityOf(task, kind),
      explanation: EXPLANATIONS[kind](task),
    });
  }
  const leaveDates = new Set(dates);
  const overlappingAbsences = teamAbsences
    .map((absence) => ({ ...absence, dates: absence.dates.filter((date) => leaveDates.has(date)) }))
    .filter((absence) => absence.dates.length > 0)
    .map(({ userId, fullName, status, dates: overlap }) => ({
      userId,
      fullName,
      status,
      dates: overlap,
    }));
  taskConflicts.sort((left, right) =>
    left.severity === right.severity ? 0 : left.severity === 'critical' ? -1 : 1,
  );
  return {
    taskConflicts,
    overlappingAbsences,
    hasCritical: taskConflicts.some((conflict) => conflict.severity === 'critical'),
  };
}
