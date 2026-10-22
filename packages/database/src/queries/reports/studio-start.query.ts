import { type CalendarDate, calendarDateInTimeZone, isCalendarDate } from '@lintel/shared';
import { min } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { organizationSettings, projects } from '../../schema';

/**
 * The first day the studio has work on record: the day it was set up, or
 * the earliest project start when projects were brought in from before
 * then. Reports count nothing before it. Null for an empty installation.
 */
export async function loadStudioStartDate(
  db: DatabaseExecutor,
  timeZone: string,
): Promise<CalendarDate | null> {
  const [organization] = await db
    .select({ createdAt: organizationSettings.createdAt })
    .from(organizationSettings)
    .limit(1);
  const [first] = await db.select({ start: min(projects.plannedStartDate) }).from(projects);
  const setUp = organization ? calendarDateInTimeZone(organization.createdAt, timeZone) : null;
  const firstProject = first?.start && isCalendarDate(first.start) ? first.start : null;
  if (setUp && firstProject) return firstProject < setUp ? firstProject : setUp;
  return setUp ?? firstProject;
}
