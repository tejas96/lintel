import {
  assessMilestoneRisk,
  type BlockerCategoryName,
  type RiskCommitment,
  type RiskProjectFacts,
  type RiskTaskFacts,
} from '@lintel/domain';
import { type CalendarDate, toCalendarDate } from '@lintel/shared';
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import {
  leaveRequests,
  milestones,
  projects,
  taskBlockers,
  taskDateChangeRequests,
  taskDependencies,
  tasks,
} from '../../schema';

export interface RiskProjectRow {
  readonly id: string;
  readonly reference: string;
  readonly name: string;
  readonly colorIndex: number;
  readonly managerUserId: string;
}

const optionalDate = (value: string | null) => (value ? toCalendarDate(value) : null);

async function loadTaskRows(db: DatabaseExecutor, projectIds: string[]) {
  return db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      milestoneId: tasks.milestoneId,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      ownerUserId: tasks.ownerUserId,
      reviewerUserId: tasks.reviewerUserId,
      plannedStartDate: tasks.plannedStartDate,
      dueDate: tasks.dueDate,
      escalateAfterOverdueDays: tasks.escalateAfterOverdueDays,
      submittedAt: tasks.submittedAt,
    })
    .from(tasks)
    .where(and(inArray(tasks.projectId, projectIds), isNull(tasks.archivedAt)));
}

async function loadTaskSignals(
  db: DatabaseExecutor,
  taskIds: string[],
  ownerIds: string[],
  today: CalendarDate,
) {
  if (taskIds.length === 0) return { edges: [], blockers: [], requests: [], leave: [] };
  const [edges, blockers, requests, leave] = await Promise.all([
    db
      .select({
        taskId: taskDependencies.taskId,
        dependsOnTaskId: taskDependencies.dependsOnTaskId,
      })
      .from(taskDependencies)
      .where(inArray(taskDependencies.taskId, taskIds)),
    db
      .select({
        taskId: taskBlockers.taskId,
        category: taskBlockers.category,
        reason: taskBlockers.reason,
        raisedAt: taskBlockers.raisedAt,
        waitingOnUserId: taskBlockers.waitingOnUserId,
      })
      .from(taskBlockers)
      .where(and(inArray(taskBlockers.taskId, taskIds), isNull(taskBlockers.resolvedAt)))
      .orderBy(asc(taskBlockers.raisedAt)),
    db
      .select({
        id: taskDateChangeRequests.id,
        taskId: taskDateChangeRequests.taskId,
        proposedDueDate: taskDateChangeRequests.proposedDueDate,
      })
      .from(taskDateChangeRequests)
      .where(
        and(
          inArray(taskDateChangeRequests.taskId, taskIds),
          eq(taskDateChangeRequests.status, 'open'),
        ),
      ),
    db
      .select({
        id: leaveRequests.id,
        userId: leaveRequests.userId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
      })
      .from(leaveRequests)
      .where(
        and(
          ownerIds.length > 0 ? inArray(leaveRequests.userId, ownerIds) : sql`false`,
          eq(leaveRequests.status, 'approved'),
          gte(leaveRequests.endDate, today),
        ),
      )
      .orderBy(desc(leaveRequests.startDate)),
  ]);
  return { edges, blockers, requests, leave };
}

type TaskRow = Awaited<ReturnType<typeof loadTaskRows>>[number];
type Signals = Awaited<ReturnType<typeof loadTaskSignals>>;

function toRiskTask(row: TaskRow, signals: Signals, today: CalendarDate): RiskTaskFacts {
  const blocker = signals.blockers.find((item) => item.taskId === row.id) ?? null;
  const request = signals.requests.find((item) => item.taskId === row.id) ?? null;
  const until = row.dueDate && row.dueDate > today ? row.dueDate : today;
  const away = row.ownerUserId
    ? signals.leave.find(
        (item) =>
          item.userId === row.ownerUserId && item.startDate <= until && item.endDate >= today,
      )
    : undefined;
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    ownerUserId: row.ownerUserId,
    reviewerUserId: row.reviewerUserId,
    plannedStartDate: optionalDate(row.plannedStartDate),
    dueDate: optionalDate(row.dueDate),
    escalateAfterOverdueDays: row.escalateAfterOverdueDays,
    submittedAt: row.status === 'in_review' ? row.submittedAt : null,
    openBlocker: blocker
      ? {
          category: blocker.category as BlockerCategoryName,
          reason: blocker.reason,
          raisedAt: blocker.raisedAt,
          waitingOnUserId: blocker.waitingOnUserId,
        }
      : null,
    openDateRequest: request
      ? { id: request.id, proposedDueDate: toCalendarDate(request.proposedDueDate) }
      : null,
    ownerAway: away
      ? {
          leaveRequestId: away.id,
          startDate: toCalendarDate(away.startDate),
          endDate: toCalendarDate(away.endDate),
        }
      : null,
  };
}

/**
 * Everything the risk card rules need for the given live projects, in six
 * queries: projects, tasks, dependencies, open blockers, open new-date
 * requests, approved leave still to come, and pending milestones with their
 * risk (domain milestone rules).
 */
export async function loadRiskFacts(
  db: DatabaseExecutor,
  projectIds: readonly string[],
  today: CalendarDate,
): Promise<{ projects: RiskProjectRow[]; facts: RiskProjectFacts[] }> {
  if (projectIds.length === 0) return { projects: [], facts: [] };
  const ids = [...projectIds];
  const [projectRows, taskRows, milestoneRows] = await Promise.all([
    db
      .select({
        id: projects.id,
        reference: projects.reference,
        name: projects.name,
        colorIndex: projects.colorIndex,
        managerUserId: projects.managerUserId,
        criticality: projects.criticality,
        plannedEndDate: projects.plannedEndDate,
      })
      .from(projects)
      .where(inArray(projects.id, ids)),
    loadTaskRows(db, ids),
    db
      .select()
      .from(milestones)
      .where(and(inArray(milestones.projectId, ids), eq(milestones.status, 'pending'))),
  ]);
  const ownerIds = [
    ...new Set(taskRows.flatMap((row) => (row.ownerUserId ? [row.ownerUserId] : []))),
  ];
  const signals = await loadTaskSignals(
    db,
    taskRows.map((row) => row.id),
    ownerIds,
    today,
  );
  const facts = projectRows.map((project): RiskProjectFacts => {
    const own = taskRows.filter((row) => row.projectId === project.id);
    const riskTasks = own.map((row) => toRiskTask(row, signals, today));
    const ownIds = new Set(own.map((row) => row.id));
    const commitments: RiskCommitment[] = milestoneRows
      .filter((milestone) => milestone.projectId === project.id)
      .map((milestone) => {
        const linkedIds = new Set(
          own.filter((row) => row.milestoneId === milestone.id).map((row) => row.id),
        );
        const linked = riskTasks.filter((task) => linkedIds.has(task.id));
        const dueDate = toCalendarDate(milestone.dueDate);
        return {
          kind: 'milestone',
          id: milestone.id,
          name: milestone.name,
          dueDate,
          health: assessMilestoneRisk(
            { name: milestone.name, status: milestone.status, dueDate, tasks: linked },
            today,
          ).health,
          taskIds: linked.map((task) => task.id),
        };
      });
    commitments.push({
      kind: 'delivery',
      id: project.id,
      name: 'Planned delivery',
      dueDate: toCalendarDate(project.plannedEndDate),
      health: null,
      taskIds: riskTasks.map((task) => task.id),
    });
    return {
      id: project.id,
      criticality: project.criticality,
      managerUserId: project.managerUserId,
      commitments,
      tasks: riskTasks,
      dependencies: signals.edges.filter((edge) => ownIds.has(edge.taskId)),
    };
  });
  return { projects: projectRows, facts };
}
