import type { TeamChanges, TeamRecord, TeamStore } from '@lintel/application';
import type { TeamDefinition } from '@lintel/domain';
import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { teams, users } from '../schema';

const columns = {
  id: teams.id,
  name: teams.name,
  description: teams.description,
  leadUserId: teams.leadUserId,
  archivedAt: teams.archivedAt,
  version: teams.version,
};

/** Team administration. Teams are archived, never deleted: people keep pointing at them. */
export class TeamRepository implements TeamStore {
  constructor(private readonly db: DatabaseExecutor) {}

  list(): Promise<TeamRecord[]> {
    return this.db.select(columns).from(teams).orderBy(asc(teams.name));
  }

  async find(teamId: string): Promise<TeamRecord | null> {
    const [row] = await this.db.select(columns).from(teams).where(eq(teams.id, teamId));
    return row ?? null;
  }

  async create(input: TeamDefinition) {
    const [row] = await this.db.insert(teams).values(input).returning(columns);
    if (!row) throw new Error('Creating the team returned no row.');
    return row;
  }

  async update(teamId: string, expectedVersion: number, changes: TeamChanges) {
    const [row] = await this.db
      .update(teams)
      .set({ ...changes, version: sql`${teams.version} + 1`, updatedAt: new Date() })
      .where(and(eq(teams.id, teamId), eq(teams.version, expectedVersion)))
      .returning(columns);
    return row ?? null;
  }

  async activeMemberCount(teamId: string) {
    const [row] = await this.db
      .select({ members: count(users.id) })
      .from(users)
      .where(and(eq(users.teamId, teamId), ne(users.status, 'deactivated')));
    return row?.members ?? 0;
  }
}
