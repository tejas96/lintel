import { type CalendarDate, eachCalendarDate, maxCalendarDate } from '@lintel/shared';
import {
  isWorkingDay,
  type WorkingCalendar,
  workingDaysInRange,
} from '../calendar/working-calendar';

export interface CapacityPerson {
  readonly userId: string;
  readonly fullName: string;
  readonly calendar: WorkingCalendar;
  /** 100 for full time, 50 for half time. */
  readonly capacityPercent: number;
}

export interface CapacityLeaveDay {
  readonly userId: string;
  readonly date: CalendarDate;
  readonly halfDayUnits: 1 | 2;
  readonly status: 'approved' | 'pending';
}

export interface CapacityTaskLoad {
  readonly taskId: string;
  readonly userId: string;
  readonly remainingMinutes: number;
  readonly estimateIsDefault: boolean;
  readonly startDate: CalendarDate | null;
  readonly dueDate: CalendarDate | null;
  /** Draft tasks are tentative; everything else is a confirmed commitment. */
  readonly commitment: 'confirmed' | 'tentative';
  readonly isBlocked: boolean;
}

export type LoadStatus = 'available' | 'balanced' | 'stretched' | 'overloaded';

export interface CapacityDay {
  readonly date: CalendarDate;
  readonly isWorkingDay: boolean;
  readonly availableMinutes: number;
  readonly confirmedMinutes: number;
  readonly tentativeMinutes: number;
  readonly blockedMinutes: number;
  readonly leave: 'approved' | 'pending' | null;
  readonly status: LoadStatus;
}

export interface PersonCapacity {
  readonly userId: string;
  readonly fullName: string;
  readonly days: readonly CapacityDay[];
  readonly availableMinutes: number;
  readonly confirmedMinutes: number;
  readonly tentativeMinutes: number;
  readonly utilization: number;
  /**
   * The person's load over the range: overloaded when the totals are, or when
   * any working day in the range is (one 10-hour day is not balanced by quiet
   * days around it).
   */
  readonly status: LoadStatus;
  /** The load of the range's totals alone (booked of available minutes). */
  readonly totalStatus: LoadStatus;
  /** Working days in the range booked beyond the day's available time. */
  readonly overloadedDays: number;
  /** Days of approved leave that still have confirmed work on them. */
  readonly bookedLeaveDays: number;
  readonly usesDefaultEstimates: boolean;
}

export const STRETCHED_THRESHOLD = 0.85;
export const OVERLOADED_THRESHOLD = 1.05;

export function loadStatus(available: number, committed: number): LoadStatus {
  if (available <= 0) return committed > 0 ? 'overloaded' : 'available';
  const ratio = committed / available;
  if (ratio > OVERLOADED_THRESHOLD) return 'overloaded';
  if (ratio >= STRETCHED_THRESHOLD) return 'stretched';
  return ratio >= 0.4 ? 'balanced' : 'available';
}

/**
 * Spreads each task's remaining effort evenly over the person's working days
 * between today (or its start) and its due date. Overdue work lands on today.
 */
function spreadLoad(
  task: CapacityTaskLoad,
  calendar: WorkingCalendar,
  today: CalendarDate,
): Map<CalendarDate, number> {
  const due = task.dueDate ?? today;
  const start = maxCalendarDate(task.startDate ?? today, today);
  const window = due < today ? [] : workingDaysInRange(calendar, start, due);
  const days = window.length > 0 ? window : [today];
  const perDay = task.remainingMinutes / days.length;
  return new Map(days.map((date) => [date, perDay]));
}

interface LoadBuckets {
  readonly confirmed: Map<CalendarDate, number>;
  readonly tentative: Map<CalendarDate, number>;
  readonly blocked: Map<CalendarDate, number>;
}

function bucketTaskLoads(
  tasks: readonly CapacityTaskLoad[],
  calendar: WorkingCalendar,
  today: CalendarDate,
): LoadBuckets {
  const buckets: LoadBuckets = { confirmed: new Map(), tentative: new Map(), blocked: new Map() };
  for (const task of tasks) {
    const target = task.isBlocked
      ? buckets.blocked
      : task.commitment === 'confirmed'
        ? buckets.confirmed
        : buckets.tentative;
    for (const [date, minutes] of spreadLoad(task, calendar, today)) {
      target.set(date, (target.get(date) ?? 0) + minutes);
    }
  }
  return buckets;
}

function buildDay(
  person: CapacityPerson,
  date: CalendarDate,
  leaveDay: CapacityLeaveDay | undefined,
  buckets: LoadBuckets,
): CapacityDay {
  const working = isWorkingDay(person.calendar, date);
  const base = working ? (person.calendar.workingMinutesPerDay * person.capacityPercent) / 100 : 0;
  const leaveShare = leaveDay?.status === 'approved' ? leaveDay.halfDayUnits / 2 : 0;
  const available = Math.round(base * (1 - leaveShare));
  const confirmedMinutes = Math.round(buckets.confirmed.get(date) ?? 0);
  return {
    date,
    isWorkingDay: working,
    availableMinutes: available,
    confirmedMinutes,
    tentativeMinutes: Math.round(buckets.tentative.get(date) ?? 0),
    blockedMinutes: Math.round(buckets.blocked.get(date) ?? 0),
    leave: leaveDay?.status ?? null,
    status: working ? loadStatus(available, confirmedMinutes) : 'available',
  };
}

const sum = (days: readonly CapacityDay[], pick: (day: CapacityDay) => number) =>
  days.reduce((total, day) => total + pick(day), 0);

export function calculatePersonCapacity(
  person: CapacityPerson,
  range: { start: CalendarDate; end: CalendarDate },
  today: CalendarDate,
  leave: readonly CapacityLeaveDay[],
  tasks: readonly CapacityTaskLoad[],
): PersonCapacity {
  const leaveByDate = new Map(leave.map((day) => [day.date, day]));
  const buckets = bucketTaskLoads(tasks, person.calendar, today);
  const days = eachCalendarDate(range.start, range.end).map((date) =>
    buildDay(person, date, leaveByDate.get(date), buckets),
  );
  const availableMinutes = sum(days, (day) => day.availableMinutes);
  const confirmedMinutes = sum(days, (day) => day.confirmedMinutes);
  const totalStatus = loadStatus(availableMinutes, confirmedMinutes);
  const overloadedDays = days.filter((day) => day.status === 'overloaded').length;
  return {
    userId: person.userId,
    fullName: person.fullName,
    days,
    availableMinutes,
    confirmedMinutes,
    tentativeMinutes: sum(days, (day) => day.tentativeMinutes),
    utilization: availableMinutes === 0 ? 0 : confirmedMinutes / availableMinutes,
    status: overloadedDays > 0 ? 'overloaded' : totalStatus,
    totalStatus,
    overloadedDays,
    bookedLeaveDays: days.filter((day) => day.leave === 'approved' && day.confirmedMinutes > 0)
      .length,
    usesDefaultEstimates: tasks.some((task) => task.estimateIsDefault),
  };
}

/** Minutes assumed for a task with no estimate. Shown to users as an assumption. */
export const DEFAULT_TASK_ESTIMATE_MINUTES = 120;
