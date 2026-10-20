import { inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { users } from '../../schema';
import type { UserSummaryView } from './view-types';

export const userSummaryColumns = {
  id: users.id,
  fullName: users.fullName,
  designation: users.designation,
  role: users.role,
  avatarHue: users.avatarHue,
  status: users.status,
};

/** Loads people by ID in one query. Unknown IDs are simply absent from the map. */
export async function loadUserSummaries(
  db: DatabaseExecutor,
  ids: readonly (string | null | undefined)[],
): Promise<Map<string, UserSummaryView>> {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === 'string'))];
  if (unique.length === 0) return new Map();
  const rows = await db.select(userSummaryColumns).from(users).where(inArray(users.id, unique));
  return new Map(rows.map((row) => [row.id, row]));
}

export function pickUser(
  map: Map<string, UserSummaryView>,
  id: string | null | undefined,
): UserSummaryView | null {
  return id ? (map.get(id) ?? null) : null;
}
