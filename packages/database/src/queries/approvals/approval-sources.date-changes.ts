import type { CalendarDate } from '@lintel/shared';
import { formatCalendarDateWords } from '@lintel/shared';
import { and, asc, eq, isNull, ne, or, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { projects, taskDateChangeRequests, tasks } from '../../schema';
import type { ApprovalViewer } from './approval-queue.query';
import {
  type ApprovalDraft,
  isStale,
  projectRefColumns,
  SOURCE_LIMIT,
} from './approval-sources.work';

const requester = taskDateChangeRequests.requestedByUserId;

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
 * Open new-date requests the viewer should decide, with the same deciders as
 * handover requests: the project manager, the project owner when the manager
 * asked, studio-wide project managers when nobody on the project can. Never
 * their own. Urgent when the task is due by today or the request is stale.
 */
export async function dateChangeApprovals(
  db: DatabaseExecutor,
  viewer: ApprovalViewer,
  today: CalendarDate,
): Promise<ApprovalDraft[]> {
  const userId = viewer.userId;
  const rows = await db
    .select({
      request: taskDateChangeRequests,
      taskTitle: tasks.title,
      taskNumber: tasks.number,
      taskDueDate: tasks.dueDate,
      project: projectRefColumns,
    })
    .from(taskDateChangeRequests)
    .innerJoin(tasks, eq(tasks.id, taskDateChangeRequests.taskId))
    .innerJoin(projects, eq(projects.id, taskDateChangeRequests.projectId))
    .where(
      and(
        eq(taskDateChangeRequests.status, 'open'),
        ne(requester, userId),
        or(
          eq(projects.managerUserId, userId),
          and(eq(projects.ownerUserId, userId), eq(requester, projects.managerUserId)),
          viewer.capabilities.has('projects.manage_any') ? nobodyOnProjectDecides() : undefined,
        ),
      ),
    )
    .orderBy(asc(taskDateChangeRequests.createdAt))
    .limit(SOURCE_LIMIT);
  return rows.map(({ request, taskTitle, taskNumber, taskDueDate, project }) => ({
    type: 'date_change_request',
    id: request.id,
    title: taskTitle,
    subtitle: `${project.name} · #${taskNumber}: due ${request.previousDueDate ? formatCalendarDateWords(request.previousDueDate) : 'not set'} → ${formatCalendarDateWords(request.proposedDueDate)}`,
    requestedByUserId: request.requestedByUserId,
    requestedAt: request.createdAt,
    project,
    linkPath: `/tasks/${request.taskId}?dateRequest=${request.id}`,
    urgency:
      (taskDueDate !== null && taskDueDate <= today) || isStale(request.createdAt, today)
        ? 'high'
        : 'normal',
  }));
}
