import type { ManagedWorkingCalendar } from '@lintel/api-contracts';
import {
  describeWorkingWeekdays,
  normalizeWeekdays,
  validateWorkingWeek,
  WORKING_WEEK_LIMITS,
  type WorkingWeek,
  workingDaySpanMinutes,
} from '@lintel/domain';
import type { WorkingCalendarInput } from './use-working-calendars';

/** The working week form as typed; hours stay text until the person is done. */
export interface WorkingWeekValues {
  readonly name: string;
  readonly workingWeekdays: readonly number[];
  readonly dayStartTime: string;
  readonly dayEndTime: string;
  readonly workingHours: string;
}

/** "8", "7.5", "7.75": hours as people type them. */
export function hoursText(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : String(Number(hours.toFixed(2)));
}

/** "8 h", "7 h 30 min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function weekValuesOf(calendar: ManagedWorkingCalendar): WorkingWeekValues {
  return {
    name: calendar.name,
    workingWeekdays: calendar.workingWeekdays,
    dayStartTime: calendar.dayStartTime,
    dayEndTime: calendar.dayEndTime,
    workingHours: hoursText(calendar.workingMinutesPerDay),
  };
}

/** A new week starts from the studio week (its days and hours), with no name yet. */
export function emptyWorkingWeek(studio?: ManagedWorkingCalendar): WorkingWeekValues {
  if (studio) return { ...weekValuesOf(studio), name: '' };
  return {
    name: '',
    workingWeekdays: [1, 2, 3, 4, 5],
    dayStartTime: '09:30',
    dayEndTime: '18:30',
    workingHours: '8',
  };
}

export function weekOf(values: WorkingWeekValues): WorkingCalendarInput {
  return {
    name: values.name.trim(),
    workingWeekdays: normalizeWeekdays(values.workingWeekdays),
    dayStartTime: values.dayStartTime,
    dayEndTime: values.dayEndTime,
    workingMinutesPerDay: Math.round(Number(values.workingHours.trim().replace(',', '.')) * 60),
  };
}

/** Only what changed, so a save never overwrites someone else's edit by accident. */
export function weekChangesOf(
  calendar: ManagedWorkingCalendar,
  values: WorkingWeekValues,
): Partial<WorkingCalendarInput> {
  const next = weekOf(values);
  return {
    ...(next.name !== calendar.name ? { name: next.name } : {}),
    ...(next.workingWeekdays.join() !== normalizeWeekdays(calendar.workingWeekdays).join()
      ? { workingWeekdays: next.workingWeekdays }
      : {}),
    ...(next.dayStartTime !== calendar.dayStartTime ? { dayStartTime: next.dayStartTime } : {}),
    ...(next.dayEndTime !== calendar.dayEndTime ? { dayEndTime: next.dayEndTime } : {}),
    ...(next.workingMinutesPerDay !== calendar.workingMinutesPerDay
      ? { workingMinutesPerDay: next.workingMinutesPerDay }
      : {}),
  };
}

/** The domain's own rules, so the form and the server say the same thing. */
export function checkWorkingWeek(values: WorkingWeekValues, needsName: boolean) {
  const week = weekOf(values);
  const errors: Record<string, string> = {};
  if (needsName && (week.name.length < 2 || week.name.length > 60)) {
    errors.name = 'Use 2 to 60 characters.';
  }
  if (!Number.isFinite(week.workingMinutesPerDay)) {
    errors.workingMinutesPerDay = 'Use hours, for example 8 or 7.5.';
  }
  for (const problem of validateWorkingWeek(week)) {
    if (!errors[problem.field]) errors[problem.field] = problem.message;
  }
  return errors;
}

/** "Monday to Saturday · 09:30–18:30 · 8 h of work a day". */
export function describeWeek(week: WorkingWeek): string {
  return [
    describeWorkingWeekdays(week.workingWeekdays),
    `${week.dayStartTime}–${week.dayEndTime}`,
    `${formatDuration(week.workingMinutesPerDay)} of work a day`,
  ].join(' · ');
}

/** "9 h between start and end, so 1 h for breaks." */
export function breakNote(values: WorkingWeekValues): string | null {
  const span = workingDaySpanMinutes(values);
  const minutes = weekOf(values).workingMinutesPerDay;
  if (span === null || span <= 0 || !Number.isFinite(minutes)) return null;
  if (minutes > span) return null;
  const breaks = span - minutes;
  return breaks === 0
    ? `${formatDuration(span)} from start to end, with no breaks.`
    : `${formatDuration(span)} from start to end, so ${formatDuration(breaks)} for breaks.`;
}

export const MAX_WORKING_HOURS = WORKING_WEEK_LIMITS.maximumWorkingMinutes / 60;
