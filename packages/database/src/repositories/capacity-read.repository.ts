import type {
  CapacityLeaveRecord,
  CapacityPersonRecord,
  CapacityReadStore,
  CapacityTaskRecord,
} from '@lintel/application';
import { OPEN_TASK_STATUSES } from '@lintel/domain';
import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { userSummaryColumns } from '../queries/shared/user-summary.query';
import { leaveRequests, taskBlockers, tasks, teams, users } from '../schema';

export class CapacityReadRepository implements CapacityReadStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async people(query: {
    readonly userIds: readonly string[] | null;
    readonly teamId: string | null;
  }): Promise<CapacityPersonRecord[]> {
    if (query.userIds !== null && query.userIds.length === 0) return [];
    const rows = await this.db
      .select({
        user: userSummaryColumns,
        teamId: users.teamId,
        teamName: teams.name,
        capacityPercent: users.capacityPercent,
      })
      .from(users)
      .leftJoin(teams, eq(teams.id, users.teamId))
      .where(
        and(
          eq(users.status, 'active'),
          query.userIds ? inArray(users.id, [...query.userIds]) : undefined,
          query.teamId ? eq(users.teamId, query.teamId) : undefined,
        ),
      )
      .orderBy(asc(users.fullName));
    return rows.map((row) => ({ ...row, teamName: row.teamName ?? null }));
  }

  async teamMemberIds(teamId: string) {
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.teamId, teamId), eq(users.status, 'active')));
    return rows.map((row) => row.id);
  }

  async directReportIds(userId: string) {
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.reportsToUserId, userId), eq(users.status, 'active')));
    return rows.map((row) => row.id);
  }

  async leaveInRange(
    userIds: readonly string[],
    start: string,
    end: string,
  ): Promise<CapacityLeaveRecord[]> {
    if (userIds.length === 0) return [];
    const rows = await this.db
      .select({
        userId: leaveRequests.userId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        dayPortion: leaveRequests.dayPortion,
        status: leaveRequests.status,
      })
      .from(leaveRequests)
      .where(
        and(
          inArray(leaveRequests.userId, [...userIds]),
          inArray(leaveRequests.status, ['pending', 'info_requested', 'approved']),
          lte(leaveRequests.startDate, end),
          gte(leaveRequests.endDate, start),
        ),
      );
    return rows.flatMap((row) =>
      row.status === 'pending' || row.status === 'info_requested' || row.status === 'approved'
        ? [{ ...row, status: row.status }]
        : [],
    );
  }

  async openTaskLoads(userIds: readonly string[]): Promise<CapacityTaskRecord[]> {
    if (userIds.length === 0) return [];
    const rows = await this.db
      .select({
        taskId: tasks.id,
        ownerUserId: tasks.ownerUserId,
        status: tasks.status,
        estimateMinutes: tasks.estimateMinutes,
        actualMinutes: tasks.actualMinutes,
        plannedStartDate: tasks.plannedStartDate,
        dueDate: tasks.dueDate,
      })
      .from(tasks)
      .where(
        and(
          inArray(tasks.ownerUserId, [...userIds]),
          inArray(tasks.status, [...OPEN_TASK_STATUSES]),
          isNull(tasks.archivedAt),
        ),
      );
    const blocked = new Set(
      rows.length === 0
        ? []
        : (
            await this.db
              .selectDistinct({ taskId: taskBlockers.taskId })
              .from(taskBlockers)
              .where(
                and(
                  inArray(
                    taskBlockers.taskId,
                    rows.map((row) => row.taskId),
                  ),
                  isNull(taskBlockers.resolvedAt),
                ),
              )
          ).map((row) => row.taskId),
    );
    return rows.flatMap((row) =>
      row.ownerUserId
        ? [{ ...row, ownerUserId: row.ownerUserId, hasOpenBlocker: blocked.has(row.taskId) }]
        : [],
    );
  }
}
