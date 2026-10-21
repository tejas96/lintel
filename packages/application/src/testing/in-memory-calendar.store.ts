import type {
  NewWorkingCalendar,
  WorkingCalendarChanges,
  WorkingCalendarRecord,
  WorkingCalendarStore,
} from '../calendars/working-calendar.store';

/** WorkingCalendarStore over an array, with the same version semantics as SQL. */
export class InMemoryCalendarStore implements WorkingCalendarStore {
  readonly calendars: WorkingCalendarRecord[] = [];
  readonly removed: string[] = [];
  private sequence = 0;

  constructor() {
    this.calendars.push({
      id: 'studio',
      name: 'Studio week',
      timeZone: 'Asia/Kolkata',
      isDefault: true,
      workingWeekdays: [1, 2, 3, 4, 5, 6],
      dayStartTime: '09:30',
      dayEndTime: '18:30',
      workingMinutesPerDay: 480,
      peopleCount: 8,
      version: 1,
    });
  }

  async list() {
    return [...this.calendars];
  }

  async find(calendarId: string) {
    return this.calendars.find((calendar) => calendar.id === calendarId) ?? null;
  }

  async create(input: NewWorkingCalendar) {
    this.sequence += 1;
    const created = {
      ...input,
      id: `calendar-${this.sequence}`,
      isDefault: false,
      peopleCount: 0,
      version: 1,
    };
    this.calendars.push(created);
    return created;
  }

  async update(calendarId: string, expectedVersion: number, changes: WorkingCalendarChanges) {
    const index = this.calendars.findIndex((calendar) => calendar.id === calendarId);
    const current = this.calendars[index];
    if (!current || current.version !== expectedVersion) return null;
    const next = { ...current, ...changes, version: current.version + 1 };
    this.calendars[index] = next;
    return next;
  }

  async remove(calendarId: string) {
    this.removed.push(calendarId);
    const index = this.calendars.findIndex((calendar) => calendar.id === calendarId);
    if (index >= 0) this.calendars.splice(index, 1);
  }
}
