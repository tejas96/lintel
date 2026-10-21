import type { Capability, Role, WorkingWeek } from '@lintel/domain';

/** What already exists in the database, checked before a first-time setup writes anything. */
export interface StudioSetupState {
  readonly settingsConfigured: boolean;
  readonly ownerExists: boolean;
  readonly defaultCalendarExists: boolean;
  readonly ownerPhoneInUse: boolean;
}

export interface NewStudioSettings {
  readonly name: string;
  readonly timeZone: string;
  readonly currency: string;
  readonly projectReferencePrefix: string;
}

export interface NewStudioOwner {
  readonly fullName: string;
  readonly phoneE164: string;
  readonly email: string | null;
  readonly workingCalendarId: string;
}

/** Persistence for the one-off production setup (an empty installation becomes a studio). */
export interface StudioSetupStore {
  /** Serialises setups: two runs at once cannot both pass the checks. */
  lock(): Promise<void>;
  state(ownerPhoneE164: string): Promise<StudioSetupState>;
  createSettings(settings: NewStudioSettings): Promise<void>;
  createDefaultCalendar(
    calendar: WorkingWeek & { readonly name: string; readonly timeZone: string },
  ): Promise<{ readonly id: string }>;
  /** Inserts the grants that are missing; returns how many were added. */
  grantRoleCapabilities(
    grants: readonly { readonly role: Role; readonly capabilities: readonly Capability[] }[],
  ): Promise<number>;
  createOwner(owner: NewStudioOwner): Promise<{ readonly id: string }>;
}
