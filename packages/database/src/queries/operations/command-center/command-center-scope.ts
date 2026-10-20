import type { CommandCenterPlan } from '@lintel/application';
import { OPEN_TASK_STATUSES } from '@lintel/domain';
import { and, eq, inArray, isNull, notInArray, or, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../client';
import { projectMembers, projects, tasks, users } from '../../../schema';

/** The projects and people one command center view covers. */
export interface CommandCenterScope {
  readonly projectIds: string[];
  readonly activeProjectIds: string[];
  readonly peopleIds: string[];
  /** Restricts task-level numbers to owners in the filtered team. */
  readonly taskOwnerCondition: SQL | undefined;
}

/**
 * Scope rules: projects that are not cancelled or archived, narrowed by the
 * project, manager and team filters (a team filter keeps projects where a
 * team member is the manager or a member). People: the whole active studio
 * (business view) or the members and task owners of the scoped projects
 * (manager view), narrowed by the team filter.
 */
export async function resolveCommandCenterScope(
  db: DatabaseExecutor,
  plan: CommandCenterPlan,
): Promise<CommandCenterScope> {
  const teamPeople = plan.teamId
    ? db.select({ id: users.id }).from(users).where(eq(users.teamId, plan.teamId))
    : undefined;
  const projectRows = await db
    .select({ id: projects.id, status: projects.status })
    .from(projects)
    .where(
      and(
        notInArray(projects.status, ['cancelled', 'archived']),
        isNull(projects.archivedAt),
        plan.projectId ? eq(projects.id, plan.projectId) : undefined,
        plan.managerUserId ? eq(projects.managerUserId, plan.managerUserId) : undefined,
        teamPeople
          ? or(
              inArray(projects.managerUserId, teamPeople),
              inArray(
                projects.id,
                db
                  .select({ id: projectMembers.projectId })
                  .from(projectMembers)
                  .where(inArray(projectMembers.userId, teamPeople)),
              ),
            )
          : undefined,
      ),
    );
  const projectIds = projectRows.map((row) => row.id);
  const activeProjectIds = projectRows
    .filter((row) => row.status === 'active')
    .map((row) => row.id);
  const peopleIds = await scopePeople(db, plan, projectIds);
  return {
    projectIds,
    activeProjectIds,
    peopleIds,
    taskOwnerCondition: teamPeople ? inArray(tasks.ownerUserId, teamPeople) : undefined,
  };
}

async function scopePeople(
  db: DatabaseExecutor,
  plan: CommandCenterPlan,
  projectIds: readonly string[],
): Promise<string[]> {
  const active = eq(users.status, 'active');
  const inTeam = plan.teamId ? eq(users.teamId, plan.teamId) : undefined;
  if (plan.scope === 'business' && !plan.projectId && !plan.managerUserId) {
    const rows = await db.select({ id: users.id }).from(users).where(and(active, inTeam));
    return rows.map((row) => row.id);
  }
  if (projectIds.length === 0) return [];
  const members = db
    .select({ id: projectMembers.userId })
    .from(projectMembers)
    .where(inArray(projectMembers.projectId, [...projectIds]));
  const owners = db
    .select({ id: tasks.ownerUserId })
    .from(tasks)
    .where(
      and(
        inArray(tasks.projectId, [...projectIds]),
        inArray(tasks.status, [...OPEN_TASK_STATUSES]),
      ),
    );
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(active, inTeam, or(inArray(users.id, members), inArray(users.id, owners))));
  return rows.map((row) => row.id);
}
