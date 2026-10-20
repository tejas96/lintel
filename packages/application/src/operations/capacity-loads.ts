import {
  type CapacityDay,
  type CapacityLeaveDay,
  type CapacityTaskLoad,
  calculatePersonCapacity,
  DEFAULT_TASK_ESTIMATE_MINUTES,
  DEFAULT_WORKING_CALENDAR,
  type LoadStatus,
  leaveDays,
  type WorkingCalendar,
} from '@lintel/domain';
import { type CalendarDate, toCalendarDate } from '@lintel/shared';
import type {
  CapacityLeaveRecord,
  CapacityPersonRecord,
  CapacityTaskRecord,
  PersonSummary,
} from './capacity.store';

export interface CapacityRow {
  readonly user: PersonSummary;
  readonly team: string | null;
  readonly availableMinutes: number;
  readonly confirmedMinutes: number;
  readonly tentativeMinutes: number;
  readonly utilization: number;
  readonly status: LoadStatus;
  readonly usesDefaultEstimates: boolean;
  readonly openTaskCount: number;
  readonly days: CapacityDay[];
}

const optionalDate = (value: string | null) => (value ? toCalendarDate(value) : null);

/**
 * Remaining effort = estimate − time already logged (never negative). A task
 * without an estimate assumes the default and is flagged; drafts are
 * tentative; blocked work is kept apart from confirmed load.
 */
export function toTaskLoad(task: CapacityTaskRecord): CapacityTaskLoad {
  const estimate = task.estimateMinutes ?? DEFAULT_TASK_ESTIMATE_MINUTES;
  return {
    taskId: task.taskId,
    userId: task.ownerUserId,
    remainingMinutes: Math.max(0, estimate - task.actualMinutes),
    estimateIsDefault: task.estimateMinutes === null,
    startDate: optionalDate(task.plannedStartDate),
    dueDate: optionalDate(task.dueDate),
    commitment: task.status === 'draft' ? 'tentative' : 'confirmed',
    isBlocked: task.status === 'blocked' || task.hasOpenBlocker,
  };
}

/** Leave expanded to working days; approved leave wins over pending on the same day. */
export function toLeaveDays(
  records: readonly CapacityLeaveRecord[],
  calendar: WorkingCalendar,
): CapacityLeaveDay[] {
  const rank = (record: CapacityLeaveRecord) => (record.status === 'approved' ? 1 : 0);
  const ordered = [...records].sort((left, right) => rank(left) - rank(right));
  return ordered.flatMap((record) =>
    leaveDays(
      {
        startDate: toCalendarDate(record.startDate),
        endDate: toCalendarDate(record.endDate),
        dayPortion: record.dayPortion,
      },
      calendar,
    ).map((day) => ({
      userId: record.userId,
      date: day.date,
      halfDayUnits: day.halfDayUnits,
      status: record.status === 'approved' ? ('approved' as const) : ('pending' as const),
    })),
  );
}

/** Capacity rows for the people over the range, using the domain calculator. */
export function buildCapacityRows(input: {
  readonly people: readonly CapacityPersonRecord[];
  readonly calendars: ReadonlyMap<string, WorkingCalendar>;
  readonly leave: readonly CapacityLeaveRecord[];
  readonly tasks: readonly CapacityTaskRecord[];
  readonly range: { start: CalendarDate; end: CalendarDate };
  readonly today: CalendarDate;
}): CapacityRow[] {
  return input.people.map((person) => {
    const userId = person.user.id;
    const calendar = input.calendars.get(userId) ?? DEFAULT_WORKING_CALENDAR;
    const tasks = input.tasks.filter((task) => task.ownerUserId === userId);
    const result = calculatePersonCapacity(
      {
        userId,
        fullName: person.user.fullName,
        calendar,
        capacityPercent: person.capacityPercent,
      },
      input.range,
      input.today,
      toLeaveDays(
        input.leave.filter((record) => record.userId === userId),
        calendar,
      ),
      tasks.map(toTaskLoad),
    );
    return {
      user: person.user,
      team: person.teamName,
      availableMinutes: result.availableMinutes,
      confirmedMinutes: result.confirmedMinutes,
      tentativeMinutes: result.tentativeMinutes,
      utilization: Math.round(result.utilization * 1000) / 1000,
      status: result.status,
      usesDefaultEstimates: result.usesDefaultEstimates,
      openTaskCount: tasks.length,
      days: [...result.days],
    };
  });
}
