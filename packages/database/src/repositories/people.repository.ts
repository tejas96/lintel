import type { PeopleStore, PersonInput, PersonRecord } from '@lintel/application';
import { definedOnly, type Patch } from '@lintel/shared';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { teams, users } from '../schema';

function toPerson(row: typeof users.$inferSelect): PersonRecord {
  return {
    id: row.id,
    fullName: row.fullName,
    phoneE164: row.phoneE164,
    email: row.email,
    designation: row.designation,
    role: row.role,
    teamId: row.teamId,
    reportsToUserId: row.reportsToUserId,
    capacityPercent: row.capacityPercent,
    workingCalendarId: row.workingCalendarId,
    status: row.status,
    version: row.version,
  };
}

export class PeopleRepository implements PeopleStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async findById(userId: string) {
    const [row] = await this.db.select().from(users).where(eq(users.id, userId));
    return row ? toPerson(row) : null;
  }

  async phoneInUse(phoneE164: string, exceptUserId: string | null) {
    const condition = exceptUserId
      ? and(eq(users.phoneE164, phoneE164), ne(users.id, exceptUserId))
      : eq(users.phoneE164, phoneE164);
    const [row] = await this.db.select({ id: users.id }).from(users).where(condition).limit(1);
    return Boolean(row);
  }

  async teamIsOpen(teamId: string) {
    const [row] = await this.db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, teamId), isNull(teams.archivedAt)));
    return Boolean(row);
  }

  async create(input: PersonInput) {
    const hue = Math.floor(Math.random() * 360);
    const [row] = await this.db
      .insert(users)
      .values({ ...input, avatarHue: hue })
      .returning();
    if (!row) throw new Error('Creating the person returned no row.');
    return toPerson(row);
  }

  async update(userId: string, expectedVersion: number, changes: Patch<PersonInput>) {
    const [row] = await this.db
      .update(users)
      .set({ ...definedOnly(changes), version: sql`${users.version} + 1`, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.version, expectedVersion)))
      .returning();
    return row ? toPerson(row) : null;
  }

  async setStatus(
    userId: string,
    expectedVersion: number,
    status: 'active' | 'deactivated',
    at: Date,
  ) {
    const [row] = await this.db
      .update(users)
      .set({
        status,
        deactivatedAt: status === 'deactivated' ? at : null,
        version: sql`${users.version} + 1`,
        updatedAt: at,
      })
      .where(and(eq(users.id, userId), eq(users.version, expectedVersion)))
      .returning();
    return row ? toPerson(row) : null;
  }
}
