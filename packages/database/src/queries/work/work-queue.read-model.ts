import type { WorkQueueSnapshot, WorkQueueSource } from '@lintel/application';
import { OPEN_TASK_STATUSES, type PriorityClock } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import { and, desc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import {
  leaveRequests,
  milestones,
  taskCollaborators,
  taskDependencies,
  tasks,
  users,
} from '../../schema';
import { loadTaskSummaries } from '../shared/task-summary.query';
import type { TaskSummaryView } from '../shared/view-types';

const QUEUE_LIMIT = 500;

/** The work queue's read side: one person's open work plus the graph around it. */
export class WorkQueueReadModel implements WorkQueueSource<TaskSummaryView> {
  constructor(private readonly db: DatabaseExecutor) {}

  async snapshotFor(
    userId: string,
    today: CalendarDate,
    clock?: PriorityClock,
  ): Promise<WorkQueueSnapshot<TaskSummaryView>> {
    const collaborating = this.db
      .select({ id: taskCollaborators.taskId })
      .from(taskCollaborators)
      .where(eq(taskCollaborators.userId, userId));
    const summaries = await loadTaskSummaries(this.db, {
      where: and(
        inArray(tasks.status, [...OPEN_TASK_STATUSES]),
        or(eq(tasks.ownerUserId, userId), inArray(tasks.id, collaborating)),
      ),
      limit: QUEUE_LIMIT,
      today,
      clock,
    });
    if (summaries.length === 0) {
      return { tasks: [], edges: [], nodes: new Map(), milestones: new Map() };
    }
    const projectIds = [...new Set(summaries.map((summary) => summary.project.id))];
    const [actuals, nodeRows, milestoneRows] = await Promise.all([
      this.db
        .select({ id: tasks.id, actualMinutes: tasks.actualMinutes })
        .from(tasks)
        .where(
          inArray(
            tasks.id,
            summaries.map((summary) => summary.id),
          ),
        ),
      this.db
        .select({ id: tasks.id, status: tasks.status, milestoneId: tasks.milestoneId })
        .from(tasks)
        .where(and(inArray(tasks.projectId, projectIds), isNull(tasks.archivedAt))),
      this.db
        .select({
          id: milestones.id,
          name: milestones.name,
          dueDate: milestones.dueDate,
          status: milestones.status,
        })
        .from(milestones)
        .where(inArray(milestones.projectId, projectIds)),
    ]);
    const edges = await this.db
      .select({
        taskId: taskDependencies.taskId,
        dependsOnTaskId: taskDependencies.dependsOnTaskId,
      })
      .from(taskDependencies)
      .where(
        inArray(
          taskDependencies.taskId,
          nodeRows.map((node) => node.id),
        ),
      );
    const actualById = new Map(actuals.map((row) => [row.id, row.actualMinutes]));
    return {
      tasks: summaries.map((summary) => ({
        summary,
        row: {
          taskId: summary.id,
          title: summary.title,
          status: summary.status,
          priority: summary.priority,
          dueDate: summary.dueDate as CalendarDate | null,
          dueTime: summary.dueTime,
          plannedStartDate: summary.plannedStartDate as CalendarDate | null,
          estimateMinutes: summary.estimateMinutes,
          actualMinutes: actualById.get(summary.id) ?? 0,
          projectCriticality: summary.projectCriticality,
          milestoneId: summary.milestone?.id ?? null,
          isOwner: summary.owner?.id === userId,
          hasOpenBlocker: summary.hasOpenBlocker,
          needsAcknowledgement: summary.needsAcknowledgement,
        },
      })),
      edges,
      nodes: new Map(nodeRows.map((node) => [node.id, node])),
      milestones: new Map(
        milestoneRows.map((milestone) => [
          milestone.id,
          {
            name: milestone.name,
            dueDate: milestone.dueDate as CalendarDate,
            isOpen: milestone.status === 'pending',
          },
        ]),
      ),
    };
  }

  reviewsWaitingFor(userId: string, today: CalendarDate) {
    return loadTaskSummaries(this.db, {
      where: and(eq(tasks.status, 'in_review'), eq(tasks.reviewerUserId, userId)),
      limit: 100,
      today,
    });
  }

  recentlyCompletedBy(userId: string, since: Date, limit: number, today: CalendarDate) {
    return loadTaskSummaries(this.db, {
      where: and(
        eq(tasks.status, 'done'),
        eq(tasks.ownerUserId, userId),
        gte(tasks.completedAt, since),
      ),
      orderBy: [desc(tasks.completedAt)],
      limit,
      today,
    });
  }

  async person(userId: string) {
    const [row] = await this.db
      .select({ fullName: users.fullName, capacityPercent: users.capacityPercent })
      .from(users)
      .where(eq(users.id, userId));
    return row ?? null;
  }

  async approvedLeaveOn(userId: string, date: CalendarDate): Promise<1 | 2 | null> {
    const [row] = await this.db
      .select({ dayPortion: leaveRequests.dayPortion })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.userId, userId),
          eq(leaveRequests.status, 'approved'),
          lte(leaveRequests.startDate, date),
          gte(leaveRequests.endDate, date),
        ),
      )
      .limit(1);
    if (!row) return null;
    return row.dayPortion === 'full' ? 2 : 1;
  }
}
