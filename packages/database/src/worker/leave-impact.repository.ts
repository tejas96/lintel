import type {
  LeaveImpactStore,
  LeaveRequestFacts,
  LeaveTaskImpactFact,
  PendingHandoverFact,
} from '@lintel/application';
import { OPEN_TASK_STATUSES } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import { and, asc, eq, inArray, isNull, ne } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { leaveHandovers, leaveRequests, milestones, projects, tasks, users } from '../schema';

/** Read-only facts for reassessing work affected by leave or an urgent absence. */
export class LeaveImpactRepository implements LeaveImpactStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async leaveRequest(leaveRequestId: string): Promise<LeaveRequestFacts | null> {
    const [row] = await this.db
      .select({
        id: leaveRequests.id,
        userId: leaveRequests.userId,
        fullName: users.fullName,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        dayPortion: leaveRequests.dayPortion,
        status: leaveRequests.status,
        isUrgentAbsence: leaveRequests.isUrgentAbsence,
      })
      .from(leaveRequests)
      .innerJoin(users, eq(users.id, leaveRequests.userId))
      .where(eq(leaveRequests.id, leaveRequestId));
    if (!row) return null;
    return {
      ...row,
      startDate: row.startDate as CalendarDate,
      endDate: row.endDate as CalendarDate,
    };
  }

  async openTasksOwnedBy(userId: string): Promise<LeaveTaskImpactFact[]> {
    const rows = await this.db
      .select({
        taskId: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        plannedStartDate: tasks.plannedStartDate,
        dueDate: tasks.dueDate,
        projectId: projects.id,
        projectName: projects.name,
        projectCriticality: projects.criticality,
        managerUserId: projects.managerUserId,
        milestoneName: milestones.name,
        milestoneDueDate: milestones.dueDate,
      })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .leftJoin(milestones, eq(milestones.id, tasks.milestoneId))
      .where(
        and(
          eq(tasks.ownerUserId, userId),
          inArray(tasks.status, [...OPEN_TASK_STATUSES]),
          isNull(tasks.archivedAt),
        ),
      )
      .orderBy(asc(tasks.dueDate));
    return rows.map((row) => ({
      ...row,
      plannedStartDate: row.plannedStartDate as CalendarDate | null,
      dueDate: row.dueDate as CalendarDate | null,
      milestoneDueDate: row.milestoneDueDate as CalendarDate | null,
    }));
  }

  async handoversNotApplied(leaveRequestId: string): Promise<PendingHandoverFact[]> {
    const rows = await this.db
      .select({
        handoverId: leaveHandovers.id,
        taskId: tasks.id,
        title: tasks.title,
        projectName: projects.name,
        managerUserId: projects.managerUserId,
        status: leaveHandovers.status,
        toUserName: users.fullName,
      })
      .from(leaveHandovers)
      .innerJoin(tasks, eq(tasks.id, leaveHandovers.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .leftJoin(users, eq(users.id, leaveHandovers.toUserId))
      .where(
        and(
          eq(leaveHandovers.leaveRequestId, leaveRequestId),
          ne(leaveHandovers.status, 'applied'),
        ),
      )
      .orderBy(asc(tasks.dueDate));
    const pending: PendingHandoverFact[] = [];
    for (const row of rows) {
      if (row.status === 'applied') continue;
      pending.push({ ...row, status: row.status });
    }
    return pending;
  }
}
