import type { CalendarDate } from '@lintel/shared';
import { and, asc, eq, ne, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { projects, taskReassignmentRequests, tasks } from '../../schema';
import {
  type ApprovalDraft,
  isStale,
  projectRefColumns,
  SOURCE_LIMIT,
} from './approval-sources.work';

function excerpt(reason: string): string {
  return reason.length > 110 ? `${reason.slice(0, 107)}…` : reason;
}

/**
 * Open reassignment requests the viewer should decide: on projects they
 * manage, or, when the project manager is the one asking, on projects they
 * own. Never their own requests.
 */
export async function reassignmentApprovals(
  db: DatabaseExecutor,
  userId: string,
  today: CalendarDate,
): Promise<ApprovalDraft[]> {
  const rows = await db
    .select({
      request: taskReassignmentRequests,
      taskTitle: tasks.title,
      taskNumber: tasks.number,
      taskDueDate: tasks.dueDate,
      project: projectRefColumns,
    })
    .from(taskReassignmentRequests)
    .innerJoin(tasks, eq(tasks.id, taskReassignmentRequests.taskId))
    .innerJoin(projects, eq(projects.id, taskReassignmentRequests.projectId))
    .where(
      and(
        eq(taskReassignmentRequests.status, 'open'),
        ne(taskReassignmentRequests.requestedByUserId, userId),
        or(
          eq(projects.managerUserId, userId),
          and(
            eq(projects.ownerUserId, userId),
            eq(taskReassignmentRequests.requestedByUserId, projects.managerUserId),
          ),
        ),
      ),
    )
    .orderBy(asc(taskReassignmentRequests.createdAt))
    .limit(SOURCE_LIMIT);
  return rows.map(({ request, taskTitle, taskNumber, taskDueDate, project }) => ({
    type: 'reassignment_request',
    id: request.id,
    title: taskTitle,
    subtitle: `${project.name} · #${taskNumber}: “${excerpt(request.reason)}”`,
    requestedByUserId: request.requestedByUserId,
    requestedAt: request.createdAt,
    project,
    linkPath: `/tasks/${request.taskId}?reassignment=${request.id}`,
    urgency:
      (taskDueDate !== null && taskDueDate <= today) || isStale(request.createdAt, today)
        ? 'high'
        : 'normal',
  }));
}
