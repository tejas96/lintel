import { and, asc, count, eq, isNotNull, isNull, ne, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { teams, users } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { UserSummaryView } from '../shared/view-types';

export interface TeamView {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly lead: UserSummaryView | null;
  /** People on the team who can sign in (invited or active). */
  readonly memberCount: number;
  readonly archivedAt: string | null;
  readonly version: number;
}

export type TeamStatusFilter = 'active' | 'archived' | 'all';

function statusCondition(status: TeamStatusFilter): SQL | undefined {
  if (status === 'active') return isNull(teams.archivedAt);
  if (status === 'archived') return isNotNull(teams.archivedAt);
  return undefined;
}

async function loadTeams(db: DatabaseExecutor, condition: SQL | undefined): Promise<TeamView[]> {
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      leadUserId: teams.leadUserId,
      archivedAt: teams.archivedAt,
      version: teams.version,
      memberCount: count(users.id),
    })
    .from(teams)
    .leftJoin(users, and(eq(users.teamId, teams.id), ne(users.status, 'deactivated')))
    .where(condition)
    .groupBy(teams.id)
    .orderBy(asc(teams.name));
  const leads = await loadUserSummaries(
    db,
    rows.map((row) => row.leadUserId),
  );
  return rows.map(({ leadUserId, archivedAt, ...team }) => ({
    ...team,
    lead: pickUser(leads, leadUserId),
    archivedAt: archivedAt?.toISOString() ?? null,
  }));
}

/** Teams by name with their lead and how many people are on each. Active teams by default. */
export function listTeams(
  db: DatabaseExecutor,
  status: TeamStatusFilter = 'active',
): Promise<TeamView[]> {
  return loadTeams(db, statusCondition(status));
}

export async function findTeam(db: DatabaseExecutor, teamId: string): Promise<TeamView | null> {
  const [team] = await loadTeams(db, eq(teams.id, teamId));
  return team ?? null;
}
