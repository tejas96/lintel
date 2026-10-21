import type { WorkingWeek } from '@lintel/domain';

/** A working calendar as its administrators see it. Holidays are managed separately. */
export interface WorkingCalendarRecord extends WorkingWeek {
  readonly id: string;
  readonly name: string;
  readonly timeZone: string;
  /** The studio week: people without a calendar of their own follow it. */
  readonly isDefault: boolean;
  /** Active people who follow this calendar (for the default, also those with none). */
  readonly peopleCount: number;
  readonly version: number;
}

export interface NewWorkingCalendar extends WorkingWeek {
  readonly name: string;
  readonly timeZone: string;
}

export type WorkingCalendarChanges = Partial<WorkingWeek & { readonly name: string }>;

/** Write side of working calendar administration (`organization.manage_settings`). */
export interface WorkingCalendarStore {
  /** The default calendar first, then by name. */
  list(): Promise<WorkingCalendarRecord[]>;
  find(calendarId: string): Promise<WorkingCalendarRecord | null>;
  create(input: NewWorkingCalendar): Promise<WorkingCalendarRecord>;
  /** Applies the change only if `expectedVersion` still matches; null on a stale version. */
  update(
    calendarId: string,
    expectedVersion: number,
    changes: WorkingCalendarChanges,
  ): Promise<WorkingCalendarRecord | null>;
  /** Removes an unused, non-default calendar and its own holidays. */
  remove(calendarId: string): Promise<void>;
}
