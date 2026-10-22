import {
  isWorkingDay,
  OVERLOADED_THRESHOLD,
  type ProjectHealthStatus,
  type WorkingCalendar,
} from '@lintel/domain';
import { addDays, type CalendarDate } from '@lintel/shared';
import { type CommandCenterSpan, isoWeekSpanOf } from './command-center.plan';

export interface CommandCenterKpi {
  readonly value: number;
  readonly previousValue: number | null;
  readonly sampleSize: number | null;
}

/** A finished task: the day it was completed (business timezone) and its due date. */
export interface CompletionFact {
  readonly completedOn: CalendarDate;
  readonly dueDate: CalendarDate | null;
}

/** A plain count straight from the records; no comparison period. */
export function countKpi(value: number): CommandCenterKpi {
  return { value, previousValue: null, sampleSize: null };
}

const within = (date: CalendarDate, span: CommandCenterSpan) =>
  date >= span.start && date <= span.end;

/**
 * On-time rate = tasks completed on or before their due date ÷ tasks completed
 * with a due date, both within the span. Tasks without a due date have no
 * deadline to meet, so they are left out of the sample. Null when empty.
 */
export function onTimeRate(
  completions: readonly CompletionFact[],
  span: CommandCenterSpan,
): { rate: number | null; sampleSize: number } {
  const sample = completions.filter(
    (fact) => fact.dueDate !== null && within(fact.completedOn, span),
  );
  if (sample.length === 0) return { rate: null, sampleSize: 0 };
  const onTime = sample.filter((fact) => fact.dueDate !== null && fact.completedOn <= fact.dueDate);
  return {
    rate: Math.round((onTime.length / sample.length) * 1000) / 1000,
    sampleSize: sample.length,
  };
}

/** The on-time KPI for the range, compared with the previous equal-length period. */
export function onTimeDeliveryKpi(
  completions: readonly CompletionFact[],
  range: CommandCenterSpan,
  previousRange: CommandCenterSpan,
): CommandCenterKpi {
  const current = onTimeRate(completions, range);
  const previous = onTimeRate(completions, previousRange);
  return { value: current.rate ?? 0, previousValue: previous.rate, sampleSize: current.sampleSize };
}

/** On-time and late completions per ISO week, oldest first, ending with the week of `endsOn`. */
export function weeklyDeliveryTrend(
  completions: readonly CompletionFact[],
  endsOn: CalendarDate,
  weeks: number,
): { weekStart: CalendarDate; onTime: number; late: number }[] {
  const thisWeek = isoWeekSpanOf(endsOn).start;
  return Array.from({ length: weeks }, (_, index) => {
    const start = addDays(thisWeek, (index - weeks + 1) * 7);
    const span = { start, end: addDays(start, 6) };
    const sample = completions.filter(
      (fact) => fact.dueDate !== null && within(fact.completedOn, span),
    );
    const onTime = sample.filter(
      (fact) => fact.dueDate !== null && fact.completedOn <= fact.dueDate,
    );
    return { weekStart: start, onTime: onTime.length, late: sample.length - onTime.length };
  });
}

const ATTENTION_ORDER: Readonly<Partial<Record<ProjectHealthStatus, number>>> = {
  off_track: 0,
  at_risk: 1,
};

/** Off-track projects first, then at-risk ones; earliest planned end first within each. */
export function projectsNeedingAttention<
  T extends { health: { status: ProjectHealthStatus }; plannedEndDate: string },
>(projects: readonly T[], limit: number): T[] {
  return projects
    .filter((project) => ATTENTION_ORDER[project.health.status] !== undefined)
    .sort(
      (left, right) =>
        (ATTENTION_ORDER[left.health.status] ?? 9) - (ATTENTION_ORDER[right.health.status] ?? 9) ||
        left.plannedEndDate.localeCompare(right.plannedEndDate),
    )
    .slice(0, limit);
}

export interface PresenceFact {
  readonly userId: string;
  readonly calendar: WorkingCalendar;
  /** Half-day units of approved leave today (2 = the whole day, 1 = half a day, 0 = none). */
  readonly leaveHalfDaysToday: number;
}

/**
 * On leave today = approved leave (including urgent absences) covering today.
 * Available today = today is one of their working days and they are not away
 * for the whole day.
 */
export function presenceToday(people: readonly PresenceFact[], today: CalendarDate) {
  return {
    availableToday: people.filter(
      (person) => isWorkingDay(person.calendar, today) && person.leaveHalfDaysToday < 2,
    ).length,
    onLeaveUserIds: people
      .filter((person) => person.leaveHalfDaysToday > 0)
      .map((person) => person.userId),
  };
}

/**
 * Overloaded = confirmed load above 105% of availability this week, or any
 * single working day booked past its available time (work on a leave day
 * counts). Most loaded first, then the most overloaded days.
 */
export function overloadedPeople<T extends { utilization: number; overloadedDays: number }>(
  rows: readonly T[],
): T[] {
  return rows
    .filter((row) => row.utilization > OVERLOADED_THRESHOLD || row.overloadedDays > 0)
    .sort(
      (left, right) =>
        right.utilization - left.utilization || right.overloadedDays - left.overloadedDays,
    );
}
