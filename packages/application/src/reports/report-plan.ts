import type { Actor } from '@lintel/domain';
import {
  addDays,
  type CalendarDate,
  daysBetween,
  ForbiddenError,
  maxCalendarDate,
  toCalendarDate,
  ValidationFailedError,
  zonedTimeToInstant,
} from '@lintel/shared';
import { type ReportGranularity, type ReportPeriod, reportPeriods } from './report-periods';

export interface ReportFilters {
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly projectId?: string | undefined;
  readonly managerUserId?: string | undefined;
  readonly teamId?: string | undefined;
}

export interface ReportSpan {
  readonly start: CalendarDate;
  readonly end: CalendarDate;
}

export interface ReportPlan {
  /** business = the whole studio; managed = only the projects the viewer manages. */
  readonly scope: 'business' | 'managed';
  readonly viewerUserId: string;
  readonly today: CalendarDate;
  /** Never starts before `studioStartDate`: days before the studio existed hold no work. */
  readonly range: ReportSpan;
  readonly studioStartDate: CalendarDate | null;
  readonly granularity: ReportGranularity;
  readonly periods: readonly ReportPeriod[];
  readonly projectId: string | null;
  /** In the managed scope this is always the viewer. */
  readonly managerUserId: string | null;
  readonly teamId: string | null;
}

export const REPORT_DEFAULT_DAYS = 90;
export const REPORT_MAX_DAYS = 366;
/** Up to this many days a report is broken down by week, beyond it by month. */
export const REPORT_WEEKLY_MAX_DAYS = 98;

/** The range as instants: from midnight of its first day to midnight after its last, in the studio timezone. */
export function reportInstantWindow(range: ReportSpan, timeZone: string): { from: Date; to: Date } {
  return {
    from: zonedTimeToInstant(range.start, '00:00', timeZone),
    to: zonedTimeToInstant(addDays(range.end, 1), '00:00', timeZone),
  };
}

/** Whether the person may open reports at all (for navigation and the API gate). */
export function canOpenReports(actor: Actor, managesProjects: boolean): boolean {
  return (
    actor.capabilities.has('dashboard.view_business') ||
    actor.role === 'project_manager' ||
    managesProjects
  );
}

/**
 * Who sees reports and over what. Holders of `dashboard.view_business` see
 * the whole studio; project managers see the same reports limited to the
 * projects they manage (and, for leave, the people whose leave they can see);
 * everyone else is refused. The range defaults to the last 90 days, today
 * included, and may span up to 366 days. It never starts before the studio
 * did (`studioStart`: its first records), so a new studio's capacity and
 * weekly charts hold no empty weeks from before it existed.
 */
export function planReport(
  actor: Actor,
  filters: ReportFilters,
  today: CalendarDate,
  managesProjects: boolean,
  studioStart: CalendarDate | null = null,
): ReportPlan {
  if (!canOpenReports(actor, managesProjects)) {
    throw new ForbiddenError('Reports are for owners, administrators and project managers.');
  }
  const business = actor.capabilities.has('dashboard.view_business');
  const end = filters.to ? toCalendarDate(filters.to) : today;
  const start = filters.from ? toCalendarDate(filters.from) : addDays(end, 1 - REPORT_DEFAULT_DAYS);
  const length = daysBetween(start, end) + 1;
  if (length < 1 || length > REPORT_MAX_DAYS) {
    throw new ValidationFailedError(`Choose a range of 1 to ${REPORT_MAX_DAYS} days.`, [
      { field: 'from', message: 'The start must be on or before the end, within a year.' },
    ]);
  }
  const range =
    studioStart && studioStart <= end
      ? { start: maxCalendarDate(start, studioStart), end }
      : { start, end };
  const counted = daysBetween(range.start, range.end) + 1;
  const granularity: ReportGranularity = counted <= REPORT_WEEKLY_MAX_DAYS ? 'week' : 'month';
  return {
    scope: business ? 'business' : 'managed',
    viewerUserId: actor.userId,
    today,
    range,
    studioStartDate: studioStart,
    granularity,
    periods: reportPeriods(range, granularity),
    projectId: filters.projectId ?? null,
    managerUserId: business ? (filters.managerUserId ?? null) : actor.userId,
    teamId: filters.teamId ?? null,
  };
}
