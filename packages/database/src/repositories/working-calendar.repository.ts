import type {
  NewWorkingCalendar,
  WorkingCalendarChanges,
  WorkingCalendarRecord,
  WorkingCalendarStore,
} from '@lintel/application';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { calendarHolidays, workingCalendars } from '../schema';

/**
 * Active people on the calendar; the default also counts people without one.
 * Written out in full: Drizzle leaves column names unqualified in a one-table
 * select, which would make the subquery compare users with themselves.
 */
const peopleCount = sql<number>`(
  select count(*)::int from users as member
  where member.status = 'active'
    and (member.working_calendar_id = "working_calendars"."id"
      or ("working_calendars"."is_default" and member.working_calendar_id is null))
)`;

const columns = {
  id: workingCalendars.id,
  name: workingCalendars.name,
  timeZone: workingCalendars.timeZone,
  isDefault: workingCalendars.isDefault,
  workingWeekdays: workingCalendars.workingWeekdays,
  dayStartTime: workingCalendars.dayStartTime,
  dayEndTime: workingCalendars.dayEndTime,
  workingMinutesPerDay: workingCalendars.workingMinutesPerDay,
  version: workingCalendars.version,
  peopleCount,
};

/** Working calendars. Capacity, planning and reminders read them through SettingsRepository. */
export class WorkingCalendarRepository implements WorkingCalendarStore {
  constructor(private readonly db: DatabaseExecutor) {}

  list(): Promise<WorkingCalendarRecord[]> {
    return this.db
      .select(columns)
      .from(workingCalendars)
      .orderBy(desc(workingCalendars.isDefault), asc(workingCalendars.name));
  }

  async find(calendarId: string): Promise<WorkingCalendarRecord | null> {
    const [row] = await this.db
      .select(columns)
      .from(workingCalendars)
      .where(eq(workingCalendars.id, calendarId));
    return row ?? null;
  }

  async create(input: NewWorkingCalendar): Promise<WorkingCalendarRecord> {
    const [row] = await this.db
      .insert(workingCalendars)
      .values({ ...input, workingWeekdays: [...input.workingWeekdays], isDefault: false })
      .returning({ id: workingCalendars.id });
    const created = row ? await this.find(row.id) : null;
    if (!created) throw new Error('Creating the working calendar returned no row.');
    return created;
  }

  async update(calendarId: string, expectedVersion: number, changes: WorkingCalendarChanges) {
    const { workingWeekdays, ...rest } = changes;
    const [row] = await this.db
      .update(workingCalendars)
      .set({
        ...rest,
        ...(workingWeekdays ? { workingWeekdays: [...workingWeekdays] } : {}),
        version: sql`${workingCalendars.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(workingCalendars.id, calendarId), eq(workingCalendars.version, expectedVersion)),
      )
      .returning({ id: workingCalendars.id });
    return row ? this.find(row.id) : null;
  }

  async remove(calendarId: string): Promise<void> {
    await this.db.delete(calendarHolidays).where(eq(calendarHolidays.calendarId, calendarId));
    await this.db
      .delete(workingCalendars)
      .where(and(eq(workingCalendars.id, calendarId), eq(workingCalendars.isDefault, false)));
  }
}
