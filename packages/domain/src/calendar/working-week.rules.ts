/**
 * The editable part of a working calendar: which weekdays people work, when
 * the day starts and ends, and how many of those minutes are working time
 * (the rest is breaks). Holidays are kept separately and apply to every week.
 */
export interface WorkingWeek {
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  readonly workingWeekdays: readonly number[];
  readonly dayStartTime: string;
  readonly dayEndTime: string;
  readonly workingMinutesPerDay: number;
}

export interface WorkingWeekProblem {
  readonly field: keyof WorkingWeek;
  readonly message: string;
}

export const WORKING_WEEK_LIMITS = {
  /** A working day shorter than an hour is almost certainly a typo. */
  minimumWorkingMinutes: 60,
  maximumWorkingMinutes: 16 * 60,
} as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

/** Minutes after midnight for "HH:mm", or null when the text is not a 24-hour time. */
export function minutesOfDay(time: string): number | null {
  const match = TIME_PATTERN.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Minutes from the day's start to its end; null when either time is invalid. */
export function workingDaySpanMinutes(week: Pick<WorkingWeek, 'dayStartTime' | 'dayEndTime'>) {
  const start = minutesOfDay(week.dayStartTime);
  const end = minutesOfDay(week.dayEndTime);
  return start === null || end === null ? null : end - start;
}

/** Weekdays sorted Monday first, without duplicates. */
export function normalizeWeekdays(weekdays: readonly number[]): number[] {
  return [...new Set(weekdays)].sort((left, right) => left - right);
}

function weekdayProblems(weekdays: readonly number[]): WorkingWeekProblem[] {
  if (weekdays.length === 0) {
    return [{ field: 'workingWeekdays', message: 'Choose at least one working day.' }];
  }
  if (weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    return [{ field: 'workingWeekdays', message: 'Weekdays run from 1 (Monday) to 7 (Sunday).' }];
  }
  return [];
}

function dayProblems(week: WorkingWeek): WorkingWeekProblem[] {
  const problems: WorkingWeekProblem[] = [];
  if (minutesOfDay(week.dayStartTime) === null) {
    problems.push({ field: 'dayStartTime', message: 'Use a 24-hour time such as 09:30.' });
  }
  if (minutesOfDay(week.dayEndTime) === null) {
    problems.push({ field: 'dayEndTime', message: 'Use a 24-hour time such as 18:30.' });
  }
  const span = workingDaySpanMinutes(week);
  if (span !== null && span <= 0) {
    problems.push({ field: 'dayEndTime', message: 'The day must end after it starts.' });
  }
  const { minimumWorkingMinutes, maximumWorkingMinutes } = WORKING_WEEK_LIMITS;
  const minutes = week.workingMinutesPerDay;
  if (!Number.isInteger(minutes) || minutes < minimumWorkingMinutes) {
    problems.push({
      field: 'workingMinutesPerDay',
      message: `Plan at least ${minimumWorkingMinutes / 60} hour of work a day.`,
    });
  } else if (minutes > maximumWorkingMinutes) {
    problems.push({
      field: 'workingMinutesPerDay',
      message: `A working day cannot be longer than ${maximumWorkingMinutes / 60} hours.`,
    });
  } else if (span !== null && span > 0 && minutes > span) {
    problems.push({
      field: 'workingMinutesPerDay',
      message: 'Working time cannot be longer than the time between the start and the end.',
    });
  }
  return problems;
}

/** Every problem with a working week, worded for the person editing it. */
export function validateWorkingWeek(week: WorkingWeek): WorkingWeekProblem[] {
  return [...weekdayProblems(week.workingWeekdays), ...dayProblems(week)];
}

/** "Monday to Saturday", "Monday, Wednesday and Friday", "Every day". */
export function describeWorkingWeekdays(weekdays: readonly number[]): string {
  const days = normalizeWeekdays(weekdays).filter((day) => day >= 1 && day <= 7);
  if (days.length === 0) return 'No working days';
  if (days.length === 7) return 'Every day';
  const names = days.map((day) => WEEKDAY_NAMES[day - 1] ?? '');
  const consecutive = days.every((day, index) => index === 0 || day === (days[index - 1] ?? 0) + 1);
  if (consecutive && days.length >= 3) return `${names[0]} to ${names[names.length - 1]}`;
  if (names.length === 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Working minutes in a full week, before capacity percentages and leave. */
export function weeklyWorkingMinutes(week: WorkingWeek): number {
  return normalizeWeekdays(week.workingWeekdays).length * week.workingMinutesPerDay;
}
