import type { HolidayRecord, OrganizationSettings, SettingsStore } from '@lintel/application';
import { CAPABILITIES, type Capability, type Role, type WorkingCalendar } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import { asc, eq, inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import {
  calendarHolidays,
  organizationSettings,
  roleCapabilities,
  users,
  workingCalendars,
} from '../schema';

const KNOWN = new Set<string>(CAPABILITIES);

export class SettingsRepository implements SettingsStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async organization(): Promise<OrganizationSettings> {
    const [row] = await this.db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.id, 1));
    if (!row) throw new Error('Organisation settings are missing. Run the database seed or setup.');
    const { id: _id, createdAt: _created, updatedAt: _updated, ...settings } = row;
    return settings;
  }

  async updateOrganization(settings: OrganizationSettings): Promise<OrganizationSettings> {
    await this.db
      .update(organizationSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(organizationSettings.id, 1));
    return this.organization();
  }

  async defaultCalendar() {
    const [calendar] = await this.db
      .select()
      .from(workingCalendars)
      .where(eq(workingCalendars.isDefault, true));
    if (!calendar) throw new Error('No default working calendar is configured.');
    return { id: calendar.id, ...(await this.toWorkingCalendar(calendar)) };
  }

  async calendarsForUsers(userIds: readonly string[]): Promise<Map<string, WorkingCalendar>> {
    const result = new Map<string, WorkingCalendar>();
    if (userIds.length === 0) return result;
    const fallback = await this.defaultCalendar();
    const rows = await this.db
      .select({ userId: users.id, calendar: workingCalendars })
      .from(users)
      .leftJoin(workingCalendars, eq(users.workingCalendarId, workingCalendars.id))
      .where(inArray(users.id, [...userIds]));
    const cache = new Map<string, WorkingCalendar>([[fallback.id, fallback]]);
    for (const row of rows) {
      const calendar = row.calendar;
      if (!calendar) {
        result.set(row.userId, fallback);
        continue;
      }
      let resolved = cache.get(calendar.id);
      if (!resolved) {
        resolved = await this.toWorkingCalendar(calendar);
        cache.set(calendar.id, resolved);
      }
      result.set(row.userId, resolved);
    }
    return result;
  }

  async listHolidays(): Promise<HolidayRecord[]> {
    const calendar = await this.defaultCalendar();
    return this.db
      .select({ id: calendarHolidays.id, date: calendarHolidays.date, name: calendarHolidays.name })
      .from(calendarHolidays)
      .where(eq(calendarHolidays.calendarId, calendar.id))
      .orderBy(asc(calendarHolidays.date));
  }

  async addHoliday(date: string, name: string): Promise<HolidayRecord> {
    const calendar = await this.defaultCalendar();
    const [row] = await this.db
      .insert(calendarHolidays)
      .values({ calendarId: calendar.id, date, name })
      .onConflictDoUpdate({
        target: [calendarHolidays.calendarId, calendarHolidays.date],
        set: { name },
      })
      .returning({
        id: calendarHolidays.id,
        date: calendarHolidays.date,
        name: calendarHolidays.name,
      });
    if (!row) throw new Error('Saving the holiday returned no row.');
    return row;
  }

  async removeHoliday(id: string): Promise<void> {
    await this.db.delete(calendarHolidays).where(eq(calendarHolidays.id, id));
  }

  async roleCapabilities() {
    const rows = await this.db.select().from(roleCapabilities);
    const byRole = new Map<Role, Capability[]>();
    for (const row of rows) {
      if (!KNOWN.has(row.capability)) continue;
      const list = byRole.get(row.role) ?? [];
      list.push(row.capability as Capability);
      byRole.set(row.role, list);
    }
    return [...byRole.entries()].map(([role, capabilities]) => ({
      role,
      capabilities: capabilities.sort(),
    }));
  }

  async replaceRoleCapabilities(role: Role, capabilities: readonly Capability[]): Promise<void> {
    await this.db.delete(roleCapabilities).where(eq(roleCapabilities.role, role));
    if (capabilities.length > 0) {
      await this.db
        .insert(roleCapabilities)
        .values(capabilities.map((capability) => ({ role, capability })));
    }
  }

  private async toWorkingCalendar(
    calendar: typeof workingCalendars.$inferSelect,
  ): Promise<WorkingCalendar> {
    const holidays = await this.db
      .select({ date: calendarHolidays.date })
      .from(calendarHolidays)
      .where(eq(calendarHolidays.calendarId, calendar.id));
    return {
      timeZone: calendar.timeZone,
      workingWeekdays: calendar.workingWeekdays,
      dayStartTime: calendar.dayStartTime,
      dayEndTime: calendar.dayEndTime,
      workingMinutesPerDay: calendar.workingMinutesPerDay,
      holidays: new Set(holidays.map((holiday) => holiday.date as CalendarDate)),
    };
  }
}
