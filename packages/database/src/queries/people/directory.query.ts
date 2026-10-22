import type { Role } from '@lintel/domain';
import { maskPhoneNumber } from '@lintel/shared';
import { and, asc, count, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { teams, users } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';

export interface DirectoryEntryView extends UserSummaryView {
  readonly email: string | null;
  readonly maskedPhone: string;
  readonly team: { readonly id: string; readonly name: string } | null;
  readonly reportsTo: UserSummaryView | null;
  readonly capacityPercent: number;
  readonly lastActiveAt: string | null;
  readonly version: number;
  /** null follows the studio week. */
  readonly workingCalendarId: string | null;
}

export interface DirectoryFilter {
  readonly search?: string | undefined;
  readonly teamId?: string | undefined;
  readonly role?: Role | undefined;
  readonly status: 'active' | 'deactivated' | 'all';
  readonly page: number;
  readonly pageSize: number;
}

function conditions(filter: DirectoryFilter): SQL | undefined {
  const parts: (SQL | undefined)[] = [];
  if (filter.status !== 'all') parts.push(eq(users.status, filter.status));
  if (filter.teamId) parts.push(eq(users.teamId, filter.teamId));
  if (filter.role) parts.push(eq(users.role, filter.role));
  if (filter.search) {
    const pattern = `%${filter.search.replace(/[%_]/g, '')}%`;
    parts.push(or(ilike(users.fullName, pattern), ilike(users.designation, pattern)));
  }
  return and(...parts);
}

/** Paginated studio directory. Phone numbers are always masked. */
export async function queryDirectory(db: DatabaseExecutor, filter: DirectoryFilter) {
  const where = conditions(filter);
  const [totals] = await db.select({ total: count() }).from(users).where(where);
  const rows = await db
    .select({ user: users, team: { id: teams.id, name: teams.name } })
    .from(users)
    .leftJoin(teams, eq(teams.id, users.teamId))
    .where(where)
    .orderBy(asc(users.fullName))
    .limit(filter.pageSize)
    .offset((filter.page - 1) * filter.pageSize);
  return { items: await toDirectoryEntries(db, rows), totalItems: totals?.total ?? 0 };
}

export async function findDirectoryEntry(
  db: DatabaseExecutor,
  userId: string,
): Promise<DirectoryEntryView | null> {
  const rows = await db
    .select({ user: users, team: { id: teams.id, name: teams.name } })
    .from(users)
    .leftJoin(teams, eq(teams.id, users.teamId))
    .where(inArray(users.id, [userId]));
  const [entry] = await toDirectoryEntries(db, rows);
  return entry ?? null;
}

async function toDirectoryEntries(
  db: DatabaseExecutor,
  rows: { user: typeof users.$inferSelect; team: { id: string; name: string } | null }[],
): Promise<DirectoryEntryView[]> {
  const managers = await loadUserSummaries(
    db,
    rows.map((row) => row.user.reportsToUserId),
  );
  return rows.map(({ user, team }) => ({
    id: user.id,
    fullName: user.fullName,
    designation: user.designation,
    role: user.role,
    avatarHue: user.avatarHue,
    status: user.status,
    email: user.email,
    maskedPhone: maskPhoneNumber(user.phoneE164),
    team: team?.id ? team : null,
    reportsTo: pickUser(managers, user.reportsToUserId),
    capacityPercent: user.capacityPercent,
    lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    version: user.version,
    workingCalendarId: user.workingCalendarId,
  }));
}
