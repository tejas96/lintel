import { type CalendarDate, isCalendarDate, maxCalendarDate } from '@lintel/shared';
import {
  addWorkingDays,
  nextWorkingDayOnOrAfter,
  type WorkingCalendar,
} from '../calendar/working-calendar';
import type { ProjectRole } from '../identity/roles';
import { topologicalTaskOrder } from '../tasks/task-dependency-graph';
import type { WorkflowTemplateDefinition } from '../workflows/workflow-template-definition';
import { templateTasksByKey } from './template-update-fields';

export interface AddedTaskSchedule {
  readonly plannedStartDate: CalendarDate;
  readonly dueDate: CalendarDate;
  readonly ownerUserId: string | null;
  readonly reviewerUserId: string | null;
}

export interface AddedTaskScheduleRequest {
  readonly definition: WorkflowTemplateDefinition;
  /** Template keys of the tasks being added. */
  readonly addedKeys: readonly string[];
  /** Due dates of the project's existing tasks, by template key. */
  readonly existingDueByKey: ReadonlyMap<string, string | null>;
  /** Nothing new starts before this date (usually today in the business timezone). */
  readonly earliestStart: CalendarDate;
  readonly calendar: WorkingCalendar;
  /** Who holds each project role: the first member with it, like at project creation. */
  readonly assignees: ReadonlyMap<ProjectRole, string>;
}

/**
 * Dates for tasks a template update adds to a running project. Each starts
 * the working day after its latest prerequisite (existing or new) is due,
 * and never before `earliestStart`; it lasts its template duration. Existing
 * tasks keep their dates.
 */
export function scheduleAddedTasks(
  request: AddedTaskScheduleRequest,
): Map<string, AddedTaskSchedule> {
  const templates = templateTasksByKey(request.definition);
  const added = new Set(request.addedKeys.filter((key) => templates.has(key)));
  const edges = [...added].flatMap((key) =>
    (templates.get(key)?.task.dependsOn ?? [])
      .filter((dependency) => added.has(dependency))
      .map((dependency) => ({ taskId: key, dependsOnTaskId: dependency })),
  );
  const order = topologicalTaskOrder([...added], edges);
  if (order === null) throw new RangeError('Template task dependencies form a loop.');
  const floor = nextWorkingDayOnOrAfter(request.calendar, request.earliestStart);
  const scheduled = new Map<string, AddedTaskSchedule>();
  for (const key of order) {
    const task = templates.get(key)?.task;
    if (!task) continue;
    const prerequisiteDue = task.dependsOn
      .map((dependency) =>
        added.has(dependency)
          ? (scheduled.get(dependency)?.dueDate ?? null)
          : (request.existingDueByKey.get(dependency) ?? null),
      )
      .filter((date): date is CalendarDate => date !== null && isCalendarDate(date));
    const afterPrerequisites =
      prerequisiteDue.length > 0
        ? addWorkingDays(
            request.calendar,
            prerequisiteDue.reduce((max, date) => maxCalendarDate(max, date)),
            1,
          )
        : floor;
    const start = maxCalendarDate(afterPrerequisites, floor);
    scheduled.set(key, {
      plannedStartDate: start,
      dueDate: addWorkingDays(request.calendar, start, Math.max(1, task.durationDays) - 1),
      ownerUserId: request.assignees.get(task.responsibleRole) ?? null,
      reviewerUserId:
        task.requiresReview && task.reviewerRole
          ? (request.assignees.get(task.reviewerRole) ?? null)
          : null,
    });
  }
  return scheduled;
}
