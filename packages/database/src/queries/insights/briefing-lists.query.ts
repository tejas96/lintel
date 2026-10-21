import {
  type CommandCenterPlan,
  deadlineWindow,
  HIGHLIGHT_LIMIT,
  INTERVENTION_LIMIT,
  type MilestoneCompletionFact,
  performanceHighlights,
} from '@lintel/application';
import { ownerInterventions, type RiskContext } from '@lintel/domain';
import {
  addDays,
  calendarDateInTimeZone,
  toCalendarDate,
  zonedTimeToInstant,
} from '@lintel/shared';
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { milestones, projects, taskBlockers, tasks } from '../../schema';
import type { CommandCenterScope } from '../operations/command-center/command-center-scope';
import { openTask, scopedTasks } from '../operations/command-center/command-center-tasks';
import { loadTaskSummaries } from '../shared/task-summary.query';
import { loadUserSummaries } from '../shared/user-summary.query';
import { loadTaskRefs } from '../tasks/task-ref.query';

const DEADLINE_LIST_LIMIT = 10;
const projectRef = {
  id: projects.id,
  reference: projects.reference,
  name: projects.name,
  colorIndex: projects.colorIndex,
};

/** Open tasks due tomorrow through a week from today, with the number of milestones due then. */
export async function deadlinesNextDays(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
  plan: CommandCenterPlan,
) {
  const window = deadlineWindow(plan.today);
  if (scope.projectIds.length === 0)
    return { range: window, taskCount: 0, milestoneCount: 0, tasks: [] };
  const inWindow = and(gte(tasks.dueDate, window.start), lte(tasks.dueDate, window.end));
  const [items, [taskTotal], [milestoneTotal]] = await Promise.all([
    loadTaskSummaries(db, {
      where: and(scopedTasks(scope), openTask, inWindow),
      orderBy: [asc(tasks.dueDate), desc(tasks.priority), asc(tasks.number)],
      limit: DEADLINE_LIST_LIMIT,
      today: plan.today,
    }),
    db
      .select({ total: count() })
      .from(tasks)
      .where(and(scopedTasks(scope), openTask, inWindow)),
    db
      .select({ total: count() })
      .from(milestones)
      .where(
        and(
          inArray(milestones.projectId, scope.projectIds),
          eq(milestones.status, 'pending'),
          gte(milestones.dueDate, window.start),
          lte(milestones.dueDate, window.end),
        ),
      ),
  ]);
  return {
    range: window,
    taskCount: taskTotal?.total ?? 0,
    milestoneCount: milestoneTotal?.total ?? 0,
    tasks: items.map(({ projectCriticality: _criticality, ...task }) => task),
  };
}

/** People who delivered milestones on time in the period (application rule). */
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
  const owners = await db
    .select({ milestoneId: tasks.milestoneId, ownerUserId: tasks.ownerUserId })
    .from(tasks)
    .where(
      and(
        inArray(
          tasks.milestoneId,
          rows.map((row) => row.milestone.id),
        ),
        eq(tasks.status, 'done'),
        scope.taskOwnerCondition,
      ),
    );
  const facts: MilestoneCompletionFact[] = rows.flatMap(({ milestone, project }) =>
    milestone.completedAt
      ? [
          {
            milestoneId: milestone.id,
            name: milestone.name,
            projectId: project.id,
            dueDate: toCalendarDate(milestone.dueDate),
            completedOn: calendarDateInTimeZone(milestone.completedAt, timeZone),
            contributorUserIds: owners.flatMap((owner) =>
              owner.milestoneId === milestone.id && owner.ownerUserId ? [owner.ownerUserId] : [],
            ),
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

/** What the timelines have escalated to the owner and is still open (domain rule), oldest first. */
export async function interventionsNeeded(
  db: DatabaseExecutor,
  scope: CommandCenterScope,
  context: RiskContext,
) {
  if (scope.projectIds.length === 0) return [];
  const [overdue, blockers] = await Promise.all([
    db
      .select({ task: tasks, criticality: projects.criticality })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(
        and(
          scopedTasks(scope),
          openTask,
          lt(tasks.dueDate, context.today),
          or(eq(tasks.priority, 'urgent'), eq(projects.criticality, 'critical')),
        ),
      ),
    db
      .select({ blocker: taskBlockers, title: tasks.title, projectId: tasks.projectId })
      .from(taskBlockers)
      .innerJoin(tasks, eq(tasks.id, taskBlockers.taskId))
      .where(and(isNull(taskBlockers.resolvedAt), scopedTasks(scope), openTask)),
  ]);
  const items = ownerInterventions(
    overdue.flatMap(({ task, criticality }) =>
      task.dueDate
        ? [
            {
              taskId: task.id,
              title: task.title,
              projectId: task.projectId,
              dueDate: toCalendarDate(task.dueDate),
              priority: task.priority,
              projectCriticality: criticality,
              escalateAfterOverdueDays: task.escalateAfterOverdueDays,
            },
          ]
        : [],
    ),
    blockers.map(({ blocker, title, projectId }) => ({
      blockerId: blocker.id,
      taskId: blocker.taskId,
      title,
      projectId,
      raisedAt: blocker.raisedAt,
      reason: blocker.reason,
    })),
    context,
  ).slice(0, INTERVENTION_LIMIT);
  if (items.length === 0) return [];
  const [refs, projectRows] = await Promise.all([
    loadTaskRefs(db, inArray(tasks.id, [...new Set(items.map((item) => item.taskId))])),
    db
      .select(projectRef)
      .from(projects)
      .where(inArray(projects.id, [...new Set(items.map((item) => item.projectId))])),
  ]);
  return items.flatMap((item) => {
    const task = refs.find((ref) => ref.id === item.taskId);
    const project = projectRows.find((row) => row.id === item.projectId);
    if (!task || !project) return [];
    return [
      {
        kind: item.kind,
        subjectId: item.subjectId,
        summary: item.summary,
        escalatedAt: item.escalatedAt.toISOString(),
        linkPath: `/tasks/${item.taskId}`,
        task,
        project,
      },
    ];
  });
}
