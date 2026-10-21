import type {
  NewStudioOwner,
  NewStudioSettings,
  StudioSetupState,
  StudioSetupStore,
} from '@lintel/application';
import type { Capability, Role, WorkingWeek } from '@lintel/domain';
import { eq, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { organizationSettings, roleCapabilities, users, workingCalendars } from '../schema';

/** Any fixed number works; it only has to be the same for every setup run. */
const SETUP_LOCK_KEY = 4_100_2026;

/** The building blocks of `seed-foundation.ts`, without any demo data. */
export class StudioSetupRepository implements StudioSetupStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async lock(): Promise<void> {
    await this.db.execute(sql`select pg_advisory_xact_lock(${SETUP_LOCK_KEY})`);
  }

  /** One query at a time: inside a transaction they share a single connection. */
  async state(ownerPhoneE164: string): Promise<StudioSetupState> {
    const settings = await this.db
      .select({ id: organizationSettings.id })
      .from(organizationSettings)
      .limit(1);
    const owners = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'owner'))
      .limit(1);
    const calendars = await this.db
      .select({ id: workingCalendars.id })
      .from(workingCalendars)
      .where(eq(workingCalendars.isDefault, true))
      .limit(1);
    const samePhone = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneE164, ownerPhoneE164))
      .limit(1);
    return {
      settingsConfigured: settings.length > 0,
      ownerExists: owners.length > 0,
      defaultCalendarExists: calendars.length > 0,
      ownerPhoneInUse: samePhone.length > 0,
    };
  }

  async createSettings(settings: NewStudioSettings): Promise<void> {
    await this.db.insert(organizationSettings).values({ id: 1, ...settings });
  }

  async createDefaultCalendar(
    calendar: WorkingWeek & { readonly name: string; readonly timeZone: string },
  ) {
    const [row] = await this.db
      .insert(workingCalendars)
      .values({ ...calendar, workingWeekdays: [...calendar.workingWeekdays], isDefault: true })
      .returning({ id: workingCalendars.id });
    if (!row) throw new Error('Creating the studio week returned no row.');
    return row;
  }

  async grantRoleCapabilities(
    grants: readonly { readonly role: Role; readonly capabilities: readonly Capability[] }[],
  ): Promise<number> {
    const rows = grants.flatMap((grant) =>
      grant.capabilities.map((capability) => ({ role: grant.role, capability })),
    );
    if (rows.length === 0) return 0;
    const added = await this.db
      .insert(roleCapabilities)
      .values(rows)
      .onConflictDoNothing()
      .returning({ role: roleCapabilities.role });
    return added.length;
  }

  async createOwner(owner: NewStudioOwner) {
    const [row] = await this.db
      .insert(users)
      .values({ ...owner, role: 'owner', status: 'active' })
      .returning({ id: users.id });
    if (!row) throw new Error('Creating the owner returned no row.');
    return row;
  }
}
