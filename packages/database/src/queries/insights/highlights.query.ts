import {
  type CommandCenterPlan,
  HIGHLIGHT_LIMIT,
  type MilestoneCompletionFact,
  type MilestoneWorkTask,
  milestoneContributors,
  performanceHighlights,
} from '@lintel/application';
import {
  addDays,
  calendarDateInTimeZone,
  toCalendarDate,
  zonedTimeToInstant,
} from '@lintel/shared';
import { and, eq, gte, inArray, isNotNull, lt } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import {
  deliverables,
  deliverableVersions,
  milestones,
  projects,
  taskDependencies,
  tasks,
  users,
} from '../../schema';
import type { CommandCenterScope } from '../operations/command-center/command-center-scope';
import { loadUserSummaries } from '../shared/user-summary.query';

const projectRef = {
  id: projects.id,
  reference: projects.reference,
  name: projects.name,
  colorIndex: projects.colorIndex,
};

/** Every task of the projects, with what it waits for and who submitted its deliverables. */
async function loadWorkTasks(
  db: DatabaseExecutor,
  projectIds: readonly string[],
): Promise<Map<string, MilestoneWorkTask[]>> {
  const inProjects = inArray(tasks.projectId, [...projectIds]);
  const [rows, dependencies, submissions] = await Promise.all([
    db
      .select({
        id: tasks.id,
        projectId: tasks.projectId,
        milestoneId: tasks.milestoneId,
        parentTaskId: tasks.parentTaskId,
        ownerUserId: tasks.ownerUserId,
        status: tasks.status,
      })
      .from(tasks)
      .where(inProjects),
    db
      .select({ taskId: taskDependencies.taskId, dependsOn: taskDependencies.dependsOnTaskId })
      .from(taskDependencies)
      .innerJoin(tasks, eq(tasks.id, taskDependencies.taskId))
      .where(inProjects),
    db
      .selectDistinct({
        taskId: deliverables.taskId,
        userId: deliverableVersions.submittedByUserId,
      })
      .from(deliverableVersions)
      .innerJoin(deliverables, eq(deliverables.id, deliverableVersions.deliverableId))
      .where(and(inArray(deliverables.projectId, [...projectIds]), isNotNull(deliverables.taskId))),
  ]);
  const byProject = new Map<string, MilestoneWorkTask[]>();
  for (const row of rows) {
    byProject.set(row.projectId, [
      ...(byProject.get(row.projectId) ?? []),
      {
        id: row.id,
        milestoneId: row.milestoneId,
        parentTaskId: row.parentTaskId,
        ownerUserId: row.ownerUserId,
        finished: row.status === 'done',
        dependsOnTaskIds: dependencies.flatMap((d) => (d.taskId === row.id ? [d.dependsOn] : [])),
        submitterUserIds: submissions.flatMap((s) => (s.taskId === row.id ? [s.userId] : [])),
      },
    ]);
  }
  return byProject;
}

/** The team filter keeps only its members; without one everyone counts. */
async function teamMembers(db: DatabaseExecutor, plan: CommandCenterPlan) {
  if (!plan.teamId) return null;
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.teamId, plan.teamId));
  return new Set(rows.map((row) => row.id));
}

/**
 * People who delivered milestones on time in the period (application rule):
 * the owners of the milestone's finished work — its own tasks, their subtasks
 * and the unlinked work they wait for — and its deliverable submitters.
 */
export async function highlightsInPeriod(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
  plan: CommandCenterPlan,
  timeZone: string,
) {
  if (scope.projectIds.length === 0) return [];
  const rows = await db
    .select({ milestone: milestones, project: projectRef })
    .from(milestones)
    .innerJoin(projects, eq(projects.id, milestones.projectId))
    .where(
      and(
        inArray(milestones.projectId, scope.projectIds),
        eq(milestones.status, 'completed'),
        gte(milestones.completedAt, zonedTimeToInstant(plan.range.start, '00:00', timeZone)),
        lt(
          milestones.completedAt,
          zonedTimeToInstant(addDays(plan.range.end, 1), '00:00', timeZone),
        ),
      ),
    );
  if (rows.length === 0) return [];
  const [work, team] = await Promise.all([
    loadWorkTasks(db, [...new Set(rows.map((row) => row.project.id))]),
    teamMembers(db, plan),
  ]);
  const facts: MilestoneCompletionFact[] = rows.flatMap(({ milestone, project }) =>
    milestone.completedAt
      ? [
          {
            milestoneId: milestone.id,
            name: milestone.name,
            projectId: project.id,
            dueDate: toCalendarDate(milestone.dueDate),
            completedOn: calendarDateInTimeZone(milestone.completedAt, timeZone),
            contributorUserIds: milestoneContributors(
              milestone.id,
              work.get(project.id) ?? [],
            ).filter((userId) => team === null || team.has(userId)),
          },
        ]
      : [],
  );
  const highlights = performanceHighlights(facts, HIGHLIGHT_LIMIT);
  const people = await loadUserSummaries(
    db,
    highlights.map((item) => item.userId),
  );
  return highlights.flatMap((item) => {
    const user = people.get(item.userId);
    if (!user) return [];
    return [
      {
        user,
        milestones: item.milestones.map((fact) => ({
          id: fact.milestoneId,
          name: fact.name,
          dueDate: fact.dueDate,
          completedOn: fact.completedOn,
          project: rows.find((row) => row.project.id === fact.projectId)?.project ?? null,
        })),
      },
    ];
  });
}
