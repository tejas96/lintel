import { OPEN_TASK_STATUSES } from '@lintel/domain';
import { type CalendarDate, daysBetween, toCalendarDate } from '@lintel/shared';
import { and, asc, eq, gte, inArray, ne, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { leaveHandovers, leaveRequests, projects, tasks, users } from '../../schema';
import type { ApprovalViewer } from './approval-queue.query';
import { type ApprovalDraft, projectRefColumns, SOURCE_LIMIT } from './approval-sources.work';

/** Leave starting within this many days makes its handovers urgent. */
const HANDOVER_URGENT_DAYS = 3;

/**
 * Leave handovers waiting on the viewer (PRODUCT_REQUIREMENTS §8: proposed,
 * accepted, then applied by a manager):
 * - the proposed colleague answers (accept or decline) while the leave is
 *   pending or approved;
 * - the project manager hands the task over once the leave is approved, for
 *   as long as the task is still (or again) with the person on leave.
 * Only leave that has not ended, and open tasks the person on leave owns.
 */
export async function leaveHandoverApprovals(
  db: DatabaseExecutor,
  viewer: ApprovalViewer,
  today: CalendarDate,
): Promise<ApprovalDraft[]> {
  const userId = viewer.userId;
  const toAnswer = and(
    eq(leaveHandovers.toUserId, userId),
    eq(leaveHandovers.status, 'proposed'),
    inArray(leaveRequests.status, ['pending', 'info_requested', 'approved']),
  );
  const toApply = and(
    eq(projects.managerUserId, userId),
    eq(leaveRequests.status, 'approved'),
    ne(leaveRequests.userId, userId),
  );
  const rows = await db
    .select({
      handoverId: leaveHandovers.id,
      status: leaveHandovers.status,
      toUserId: leaveHandovers.toUserId,
      createdAt: leaveHandovers.createdAt,
      requestId: leaveRequests.id,
      requesterId: leaveRequests.userId,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      fullName: users.fullName,
      taskTitle: tasks.title,
      project: projectRefColumns,
    })
    .from(leaveHandovers)
    .innerJoin(leaveRequests, eq(leaveRequests.id, leaveHandovers.leaveRequestId))
    .innerJoin(users, eq(users.id, leaveRequests.userId))
    .innerJoin(tasks, eq(tasks.id, leaveHandovers.taskId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(
        gte(leaveRequests.endDate, today),
        eq(tasks.ownerUserId, leaveRequests.userId),
        inArray(tasks.status, [...OPEN_TASK_STATUSES]),
        or(toAnswer, toApply),
      ),
    )
    .orderBy(asc(leaveRequests.startDate), asc(leaveHandovers.createdAt))
    .limit(SOURCE_LIMIT);
  return rows.map((row) => {
    const first = row.fullName.split(' ')[0] ?? row.fullName;
    const answering = row.toUserId === userId && row.status === 'proposed';
    const dates =
      row.startDate === row.endDate ? row.startDate : `${row.startDate} to ${row.endDate}`;
    return {
      type: 'leave_handover',
      id: row.handoverId,
      title: answering ? `Cover “${row.taskTitle}” for ${first}` : `Hand over “${row.taskTitle}”`,
      subtitle: answering
        ? `${first} is away ${dates} · accept or decline`
        : `${first} is away ${dates} · choose who covers`,
      requestedByUserId: row.requesterId,
      requestedAt: row.createdAt,
      project: row.project,
      linkPath: `/leave/${row.requestId}`,
      urgency:
        daysBetween(today, toCalendarDate(row.startDate)) <= HANDOVER_URGENT_DAYS
          ? 'high'
          : 'normal',
    };
  });
}
