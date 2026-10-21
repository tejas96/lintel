import type { Capability, Role, WorkingCalendar } from '@lintel/domain';

export interface OrganizationSettings {
  readonly name: string;
  readonly timeZone: string;
  readonly currency: string;
  readonly projectReferencePrefix: string;
  readonly deadlineReminderTime: string;
  readonly defaultQuietHoursStart: string;
  readonly defaultQuietHoursEnd: string;
  readonly leaveSecondApprovalAboveHalfDays: number;
  readonly workTrackingEnabled: boolean;
  /** Budget against recorded cost on projects and the command center. Off by default. */
  readonly profitabilityEnabled: boolean;
}

export interface HolidayRecord {
  readonly id: string;
  readonly date: string;
  readonly name: string;
}

/** Studio-wide configuration: settings, the working calendar and role grants. */
export interface SettingsStore {
  organization(): Promise<OrganizationSettings>;
  updateOrganization(settings: OrganizationSettings): Promise<OrganizationSettings>;
  /** The default working calendar with its holidays. */
  defaultCalendar(): Promise<WorkingCalendar & { readonly id: string }>;
  /** Each person's calendar (falls back to the default). Keyed by user ID. */
  calendarsForUsers(userIds: readonly string[]): Promise<Map<string, WorkingCalendar>>;
  listHolidays(): Promise<HolidayRecord[]>;
  addHoliday(date: string, name: string): Promise<HolidayRecord>;
  removeHoliday(id: string): Promise<void>;
  roleCapabilities(): Promise<{ role: Role; capabilities: Capability[] }[]>;
  replaceRoleCapabilities(role: Role, capabilities: readonly Capability[]): Promise<void>;
}
