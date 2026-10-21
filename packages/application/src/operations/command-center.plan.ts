import type { Actor } from '@lintel/domain';
import {
  addDays,
  type CalendarDate,
  daysBetween,
  ForbiddenError,
  isoWeekday,
  minCalendarDate,
  toCalendarDate,
  ValidationFailedError,
} from '@lintel/shared';

export interface CommandCenterFilters {
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly projectId?: string | undefined;
  readonly managerUserId?: string | undefined;
  readonly teamId?: string | undefined;
}

export interface CommandCenterSpan {
  readonly start: CalendarDate;
  readonly end: CalendarDate;
}

export interface CommandCenterPlan {
  /** business = the whole studio; managed = only projects the viewer manages. */
  readonly scope: 'business' | 'managed';
  readonly viewerUserId: string;
  readonly today: CalendarDate;
  readonly range: CommandCenterSpan;
  /** The equal-length period right before `range`, for comparisons. */
  readonly previousRange: CommandCenterSpan;
  /** Monday to Sunday of the current week. */
  readonly week: CommandCenterSpan;
  /** Today through Sunday: the part of the week whose load can still change, for overload. */
  readonly remainingWeek: CommandCenterSpan;
  /** Today and the next 14 days, for upcoming milestones. */
  readonly milestoneHorizon: CommandCenterSpan;
  readonly projectId: string | null;
  /** In the managed scope this is always the viewer. */
  readonly managerUserId: string | null;
  readonly teamId: string | null;
  /** Compensation totals are shown only with `rewards.view_all`. */
  readonly includeRewards: boolean;
  readonly trendWeeks: number;
  /** The delivery trend ends with the week holding this day: the period's end, never after today. */
  readonly trendEndsOn: CalendarDate;
}

export const COMMAND_CENTER_DEFAULT_DAYS = 30;
export const COMMAND_CENTER_MAX_DAYS = 366;
export const MILESTONE_HORIZON_DAYS = 14;
export const DELIVERY_TREND_WEEKS = 8;

export function isoWeekSpanOf(date: CalendarDate): CommandCenterSpan {
  const start = addDays(date, 1 - isoWeekday(date));
  return { start, end: addDays(start, 6) };
}

/**
 * Who sees the command center and over what. Owners and administrators
 * (`dashboard.view_business`) see the whole studio; a project manager without
 * it sees the same view limited to the projects they manage; everyone else is
 * refused. The range defaults to the last 30 days, today included.
 */
export function planCommandCenter(
  actor: Actor,
  filters: CommandCenterFilters,
  today: CalendarDate,
  managesProjects: boolean,
): CommandCenterPlan {
  const business = actor.capabilities.has('dashboard.view_business');
  if (!business && actor.role !== 'project_manager' && !managesProjects) {
    throw new ForbiddenError('The command center is for owners, administrators and managers.');
  }
  const end = filters.to ? toCalendarDate(filters.to) : today;
  const start = filters.from
    ? toCalendarDate(filters.from)
    : addDays(end, 1 - COMMAND_CENTER_DEFAULT_DAYS);
  const length = daysBetween(start, end) + 1;
  if (length < 1 || length > COMMAND_CENTER_MAX_DAYS) {
    throw new ValidationFailedError(`Choose a range of 1 to ${COMMAND_CENTER_MAX_DAYS} days.`, [
      { field: 'from', message: 'The start must be on or before the end.' },
    ]);
  }
  const previousEnd = addDays(start, -1);
  return {
    scope: business ? 'business' : 'managed',
    viewerUserId: actor.userId,
    today,
    range: { start, end },
    previousRange: { start: addDays(previousEnd, 1 - length), end: previousEnd },
    week: isoWeekSpanOf(today),
    remainingWeek: { start: today, end: isoWeekSpanOf(today).end },
    milestoneHorizon: { start: today, end: addDays(today, MILESTONE_HORIZON_DAYS) },
    projectId: filters.projectId ?? null,
    managerUserId: business ? (filters.managerUserId ?? null) : actor.userId,
    teamId: filters.teamId ?? null,
    includeRewards: actor.capabilities.has('rewards.view_all'),
    trendWeeks: DELIVERY_TREND_WEEKS,
    trendEndsOn: minCalendarDate(end, today),
  };
}
