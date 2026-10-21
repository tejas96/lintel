import type { DateChangeStatus } from '@lintel/domain';
import { desc, eq, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { projects, taskDateChangeRequests, tasks } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { ProjectRefView, TaskRefView, UserSummaryView } from '../shared/view-types';
import { taskRefColumns } from '../tasks/task-ref.query';

export interface DateChangeRequestView {
  readonly id: string;
  readonly task: TaskRefView;
  readonly project: ProjectRefView;
  readonly status: DateChangeStatus;
  readonly reason: string;
  readonly previousStartDate: string | null;
  readonly previousDueDate: string | null;
  readonly proposedStartDate: string | null;
  readonly proposedDueDate: string;
  readonly requestedBy: UserSummaryView;
  readonly decidedBy: UserSummaryView | null;
  readonly decidedAt: string | null;
  readonly decisionNote: string | null;
  readonly createdAt: string;
  readonly version: number;
}

const FORMER_MEMBER: UserSummaryView = {
  id: '00000000-0000-0000-0000-000000000000',
  fullName: 'Former member',
  designation: null,
  role: 'employee',
  avatarHue: 0,
  status: 'deactivated',
};

async function loadRequests(db: DatabaseExecutor, where: SQL): Promise<DateChangeRequestView[]> {
  const rows = await db
    .select({
      request: taskDateChangeRequests,
      task: taskRefColumns,
      project: {
        id: projects.id,
        reference: projects.reference,
        name: projects.name,
        colorIndex: projects.colorIndex,
      },
    })
    .from(taskDateChangeRequests)
    .innerJoin(tasks, eq(tasks.id, taskDateChangeRequests.taskId))
    .innerJoin(projects, eq(projects.id, taskDateChangeRequests.projectId))
    .where(where)
    .orderBy(desc(taskDateChangeRequests.createdAt));
  const people = await loadUserSummaries(
    db,
    rows.flatMap(({ request }) => [request.requestedByUserId, request.decidedByUserId]),
  );
  return rows.map(({ request, task, project }) => ({
    id: request.id,
    task,
    project,
    status: request.status,
    reason: request.reason,
    previousStartDate: request.previousStartDate,
    previousDueDate: request.previousDueDate,
    proposedStartDate: request.proposedStartDate,
    proposedDueDate: request.proposedDueDate,
    requestedBy: pickUser(people, request.requestedByUserId) ?? FORMER_MEMBER,
    decidedBy: pickUser(people, request.decidedByUserId),
    decidedAt: request.decidedAt?.toISOString() ?? null,
    decisionNote: request.decisionNote,
    createdAt: request.createdAt.toISOString(),
    version: request.version,
  }));
}

/** Every new-date request on a task, newest first. Callers check task access first. */
export function listTaskDateChanges(db: DatabaseExecutor, taskId: string) {
  return loadRequests(db, eq(taskDateChangeRequests.taskId, taskId));
}

export async function findDateChangeRequest(
  db: DatabaseExecutor,
  requestId: string,
): Promise<DateChangeRequestView | null> {
  const [view] = await loadRequests(db, eq(taskDateChangeRequests.id, requestId));
  return view ?? null;
}
