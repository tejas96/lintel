import type { ReportPlan } from '@lintel/application';
import { and, eq, inArray, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { projectMembers, projects, tasks, teams, users } from '../../schema';

/** The projects and people one report covers. */
export interface ReportScope {
  readonly projectIds: string[];
  /** Members of the filtered team, or null without a team filter. */
  readonly teamUserIds: string[] | null;
  /**
   * True when the report covers every project (the business view without a
   * project or manager filter); otherwise only the scoped projects count.
   */
  readonly allProjects: boolean;
}

/**
 * Projects: every project (history matters, so completed and archived ones
 * count), narrowed by the project and manager filters — always the viewer as
 * manager in the managed scope — and by the team filter (projects whose
 * manager or a member is in the team).
 */
export async function resolveReportScope(
  db: DatabaseExecutor,
  plan: ReportPlan,
): Promise<ReportScope> {
  const teamUserIds = plan.teamId
    ? (await db.select({ id: users.id }).from(users).where(eq(users.teamId, plan.teamId))).map(
        (row) => row.id,
      )
    : null;
  const allProjects = plan.scope === 'business' && !plan.projectId && !plan.managerUserId;
  if (teamUserIds !== null && teamUserIds.length === 0) {
    return { projectIds: [], teamUserIds, allProjects };
  }
  const inTeam =
    teamUserIds === null
      ? undefined
      : or(
          inArray(projects.managerUserId, teamUserIds),
          inArray(
            projects.id,
            db
              .select({ id: projectMembers.projectId })
              .from(projectMembers)
              .where(inArray(projectMembers.userId, teamUserIds)),
          ),
        );
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        plan.projectId ? eq(projects.id, plan.projectId) : undefined,
        plan.managerUserId ? eq(projects.managerUserId, plan.managerUserId) : undefined,
        inTeam,
      ),
    );
  return { projectIds: rows.map((row) => row.id), teamUserIds, allProjects };
}

/**
 * People a project-bound report covers: members and task owners of the
 * scoped projects (narrowed to the team). In the business view without
 * project or manager filters: every person, or the team.
 */
export async function scopePeople(
  db: DatabaseExecutor,
  scope: ReportScope,
  options: { readonly activeOnly: boolean },
): Promise<string[]> {
  const active = options.activeOnly ? eq(users.status, 'active') : undefined;
  const team = scope.teamUserIds === null ? undefined : inArray(users.id, scope.teamUserIds);
  if (scope.teamUserIds !== null && scope.teamUserIds.length === 0) return [];
  if (scope.allProjects) {
    const rows = await db.select({ id: users.id }).from(users).where(and(active, team));
    return rows.map((row) => row.id);
  }
  if (scope.projectIds.length === 0) return [];
  const members = db
    .select({ id: projectMembers.userId })
    .from(projectMembers)
    .where(inArray(projectMembers.projectId, scope.projectIds));
  const owners = db
    .select({ id: tasks.ownerUserId })
    .from(tasks)
    .where(inArray(tasks.projectId, scope.projectIds));
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(active, team, or(inArray(users.id, members), inArray(users.id, owners))));
  return rows.map((row) => row.id);
}

/** Team names per person, for report rows. */
export async function teamNamesOf(
  db: DatabaseExecutor,
  userIds: readonly string[],
): Promise<Map<string, { id: string; name: string } | null>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: users.id, teamId: teams.id, teamName: teams.name })
    .from(users)
    .leftJoin(teams, eq(teams.id, users.teamId))
    .where(inArray(users.id, [...userIds]));
  return new Map(
    rows.map((row) => [
      row.userId,
      row.teamId && row.teamName ? { id: row.teamId, name: row.teamName } : null,
    ]),
  );
}
