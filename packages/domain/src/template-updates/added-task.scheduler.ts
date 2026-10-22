import { type CalendarDate, isCalendarDate, maxCalendarDate } from '@lintel/shared';
import {
  addWorkingDays,
  nextWorkingDayOnOrAfter,
  type WorkingCalendar,
} from '../calendar/working-calendar';
import type { ProjectRole } from '../identity/roles';
import type { WorkflowTemplateDefinition } from '../workflows/workflow-template-definition';
import type { StageSpan } from './stage-spans';
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
  /** Where the project's stages sit today, by template stage key (see `existingStageSpans`). */
  readonly existingStageSpans: ReadonlyMap<string, StageSpan>;
  /** Nothing new starts before this date (usually today in the business timezone). */
  readonly earliestStart: CalendarDate;
  readonly calendar: WorkingCalendar;
  /** Who holds each project role: the first member with it, like at project creation. */
  readonly assignees: ReadonlyMap<ProjectRole, string>;
}

export interface AddedWorkSchedule {
  readonly tasks: Map<string, AddedTaskSchedule>;
  /** The first day each stage of the new version can hold work, by stage key. */
  readonly stageStarts: Map<string, CalendarDate>;
}

/** The new tasks in template order (stage by stage), each after the new tasks it waits for. */
function schedulingOrder(
  definition: WorkflowTemplateDefinition,
  added: ReadonlySet<string>,
): string[] {
  const templates = templateTasksByKey(definition);
  const pending = definition.stages.flatMap((stage) =>
    stage.tasks.filter((task) => added.has(task.key)).map((task) => task.key),
  );
  const order: string[] = [];
  const done = new Set<string>();
  while (pending.length > 0) {
    const index = pending.findIndex((key) =>
      (templates.get(key)?.task.dependsOn ?? []).every(
        (dependency) => !added.has(dependency) || done.has(dependency),
      ),
    );
    if (index < 0) throw new RangeError('Template task dependencies form a loop.');
    const [key] = pending.splice(index, 1);
    if (key === undefined) break;
    order.push(key);
    done.add(key);
  }
  return order;
}

/**
 * Dates for work a template update adds to a running project. A new task
 * sits inside its stage: it starts no earlier than the stage does (the
 * stage's earliest planned task, or the working day after the previous
 * stage ends for a stage with no work yet), the working day after its
 * latest prerequisite (existing or new) is due, and never before
 * `earliestStart`. It lasts its template duration. Existing tasks keep
 * their dates.
 */
export function scheduleAddedWork(request: AddedTaskScheduleRequest): AddedWorkSchedule {
  const { calendar, definition } = request;
  const templates = templateTasksByKey(definition);
  const added = new Set(request.addedKeys.filter((key) => templates.has(key)));
  const floor = nextWorkingDayOnOrAfter(calendar, request.earliestStart);
  const stageKeys = definition.stages.map((stage) => stage.key);
  const ends = new Map<string, CalendarDate>(
    [...request.existingStageSpans].map(([key, span]) => [key, span.end]),
  );
  const stageStart = (stageKey: string): CalendarDate => {
    const existing = request.existingStageSpans.get(stageKey);
    if (existing) return maxCalendarDate(floor, nextWorkingDayOnOrAfter(calendar, existing.start));
    const earlier = stageKeys.slice(0, Math.max(0, stageKeys.indexOf(stageKey))).reverse();
    const previousEnd = earlier.map((key) => ends.get(key)).find((end) => end !== undefined);
    return previousEnd ? maxCalendarDate(floor, addWorkingDays(calendar, previousEnd, 1)) : floor;
  };
  const tasks = new Map<string, AddedTaskSchedule>();
  for (const key of schedulingOrder(definition, added)) {
    const entry = templates.get(key);
    if (!entry) continue;
    const { task } = entry;
    const prerequisiteDue = task.dependsOn
      .map((dependency) =>
        added.has(dependency)
          ? (tasks.get(dependency)?.dueDate ?? null)
          : (request.existingDueByKey.get(dependency) ?? null),
      )
      .filter((date): date is CalendarDate => date !== null && isCalendarDate(date));
    const inStage = stageStart(entry.stageKey);
    const start =
      prerequisiteDue.length > 0
        ? maxCalendarDate(
            inStage,
            addWorkingDays(
              calendar,
              prerequisiteDue.reduce((max, date) => maxCalendarDate(max, date)),
              1,
            ),
          )
        : inStage;
    const dueDate = addWorkingDays(calendar, start, Math.max(1, task.durationDays) - 1);
    const end = ends.get(entry.stageKey);
    ends.set(entry.stageKey, end ? maxCalendarDate(end, dueDate) : dueDate);
    tasks.set(key, {
      plannedStartDate: start,
      dueDate,
      ownerUserId: request.assignees.get(task.responsibleRole) ?? null,
      reviewerUserId:
        task.requiresReview && task.reviewerRole
          ? (request.assignees.get(task.reviewerRole) ?? null)
          : null,
    });
  }
  return { tasks, stageStarts: new Map(stageKeys.map((key) => [key, stageStart(key)])) };
}

/** The added tasks' dates and people (see `scheduleAddedWork`). */
export function scheduleAddedTasks(
  request: AddedTaskScheduleRequest,
): Map<string, AddedTaskSchedule> {
  return scheduleAddedWork(request).tasks;
}
