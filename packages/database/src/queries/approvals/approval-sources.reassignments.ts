import type { CalendarDate } from '@lintel/shared';
import { and, asc, eq, isNull, ne, or, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { projects, taskReassignmentRequests, tasks } from '../../schema';
import type { ApprovalViewer } from './approval-queue.query';
import {
  type ApprovalDraft,
  isStale,
  projectRefColumns,
  SOURCE_LIMIT,
} from './approval-sources.work';

function excerpt(reason: string): string {
  return reason.length > 110 ? `${reason.slice(0, 107)}…` : reason;
}

const requester = taskReassignmentRequests.requestedByUserId;

/** Requests nobody on the project can decide: no manager, or the manager asked and owns it too. */
function nobodyOnProjectDecides(): SQL | undefined {
  return or(
    isNull(projects.managerUserId),
    and(
      eq(requester, projects.managerUserId),
      or(isNull(projects.ownerUserId), eq(projects.ownerUserId, requester)),
    ),
  );
}

/**
 * Open reassignment requests the viewer should decide: on projects they
 * manage, or, when the project manager is the one asking, on projects they
 * own; studio-wide project managers also get those nobody on the project
 * can decide. Never their own requests.
 */
export async function reassignmentApprovals(
  db: DatabaseExecutor,
  viewer: ApprovalViewer,
  today: CalendarDate,
): Promise<ApprovalDraft[]> {
  const userId = viewer.userId;
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
        ne(requester, userId),
        or(
          eq(projects.managerUserId, userId),
          and(eq(projects.ownerUserId, userId), eq(requester, projects.managerUserId)),
          viewer.capabilities.has('projects.manage_any') ? nobodyOnProjectDecides() : undefined,
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
