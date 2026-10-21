import { type CalendarDate, maxCalendarDate } from '@lintel/shared';
import {
  addWorkingDays,
  shiftByWorkingDays,
  type WorkingCalendar,
  workingDaysBetween,
} from '../calendar/working-calendar';
import { type TaskDependencyEdge, topologicalTaskOrder } from './task-dependency-graph';
import { isOpenTaskStatus, type TaskStatus } from './task-status';

export interface RescheduleTaskFact {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly plannedStartDate: CalendarDate | null;
  readonly dueDate: CalendarDate | null;
}

/** New dates for a task someone dragged or resized. */
export interface TaskDateChange {
  readonly taskId: string;
  readonly plannedStartDate: CalendarDate;
  readonly dueDate: CalendarDate;
}

export interface RescheduledTask {
  readonly taskId: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly currentStartDate: CalendarDate | null;
  readonly currentDueDate: CalendarDate | null;
  /** Null only for a task that had no start date and still has none. */
  readonly proposedStartDate: CalendarDate | null;
  readonly proposedDueDate: CalendarDate;
  /** Working days the due date moves (negative when earlier). */
  readonly shiftWorkingDays: number;
  /** Moved because work it waits for moved, not because someone moved it. */
  readonly isDownstream: boolean;
}

export interface ReschedulePlan {
  readonly moves: readonly RescheduledTask[];
  /** The latest open due date once the moves apply. */
  readonly forecastEndDate: CalendarDate | null;
  /** Working days the forecast lands after the agreed (planned) end; 0 when it does not. */
  readonly projectEndImpactDays: number;
}

export interface RescheduleInput {
  readonly tasks: readonly RescheduleTaskFact[];
  readonly dependencies: readonly TaskDependencyEdge[];
  readonly changes: readonly TaskDateChange[];
  readonly calendar: WorkingCalendar;
  readonly plannedEndDate: CalendarDate;
}

interface Dates {
  readonly start: CalendarDate | null;
  readonly due: CalendarDate | null;
}

/** Why a requested change cannot be planned, or null when it can. */
export function rescheduleChangeIssue(
  task: RescheduleTaskFact | undefined,
  change: TaskDateChange,
): string | null {
  if (!task) return 'This task is not part of the project.';
  if (!isOpenTaskStatus(task.status)) return `"${task.title}" is already closed.`;
  if (change.plannedStartDate > change.dueDate) return 'Start on or before the due date.';
  return null;
}

/**
 * Works out the knock-on effect of new dates (finish-to-start): a task that
 * waits on moved work is pushed just far enough to start the working day
 * after its latest prerequisite, keeping its length in working days. Slack
 * absorbs a delay, and pulling work earlier never pulls what follows it,
 * because that work may wait on other tasks too. Closed tasks never move.
 */
export function planTaskReschedule(input: RescheduleInput): ReschedulePlan {
  const { calendar } = input;
  const open = input.tasks.filter((task) => isOpenTaskStatus(task.status));
  const byId = new Map(open.map((task) => [task.id, task]));
  const explicit = new Map(input.changes.map((change) => [change.taskId, change]));
  const edges = input.dependencies.filter(
    (edge) => byId.has(edge.taskId) && byId.has(edge.dependsOnTaskId),
  );
  const order = topologicalTaskOrder([...byId.keys()], edges) ?? [...byId.keys()];
  const dates = new Map<string, Dates>(
    open.map((task) => [task.id, { start: task.plannedStartDate, due: task.dueDate }]),
  );
  const moved = new Set<string>();
  for (const taskId of order) {
    const change = explicit.get(taskId);
    if (change) {
      dates.set(taskId, { start: change.plannedStartDate, due: change.dueDate });
      moved.add(taskId);
      continue;
    }
    const pushed = pushAfterMovedPrerequisites(taskId, edges, dates, moved, calendar);
    if (pushed) {
      dates.set(taskId, pushed);
      moved.add(taskId);
    }
  }
  const moves = open.flatMap((task): RescheduledTask[] => {
    const next = dates.get(task.id);
    if (!moved.has(task.id) || !next?.due) return [];
    if (next.start === task.plannedStartDate && next.due === task.dueDate) return [];
    return [
      {
        taskId: task.id,
        title: task.title,
        status: task.status,
        currentStartDate: task.plannedStartDate,
        currentDueDate: task.dueDate,
        proposedStartDate: next.start,
        proposedDueDate: next.due,
        shiftWorkingDays: task.dueDate ? workingDaysBetween(calendar, task.dueDate, next.due) : 0,
        isDownstream: !explicit.has(task.id),
      },
    ];
  });
  const forecastEndDate = open.reduce<CalendarDate | null>((latest, task) => {
    const due = dates.get(task.id)?.due ?? null;
    return due && (!latest || due > latest) ? due : latest;
  }, null);
  const projectEndImpactDays =
    forecastEndDate && forecastEndDate > input.plannedEndDate
      ? workingDaysBetween(calendar, input.plannedEndDate, forecastEndDate)
      : 0;
  return { moves, forecastEndDate, projectEndImpactDays };
}

function pushAfterMovedPrerequisites(
  taskId: string,
  edges: readonly TaskDependencyEdge[],
  dates: ReadonlyMap<string, Dates>,
  moved: ReadonlySet<string>,
  calendar: WorkingCalendar,
): Dates | null {
  const own = dates.get(taskId);
  const start = own?.start ?? own?.due ?? null;
  if (!own || !start) return null;
  const movedDues = edges
    .filter((edge) => edge.taskId === taskId && moved.has(edge.dependsOnTaskId))
    .map((edge) => dates.get(edge.dependsOnTaskId)?.due ?? null)
    .filter((due): due is CalendarDate => due !== null);
  if (movedDues.length === 0) return null;
  const earliest = addWorkingDays(calendar, movedDues.reduce(maxCalendarDate), 1);
  if (start >= earliest) return null;
  const shift = workingDaysBetween(calendar, start, earliest);
  return {
    start: own.start ? earliest : null,
    due: own.due ? shiftByWorkingDays(calendar, own.due, shift) : earliest,
  };
}
