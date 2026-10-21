import type { ReassignmentStatus } from '@lintel/domain';
import { desc, eq, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { projects, taskReassignmentRequests, tasks } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { ProjectRefView, TaskRefView, UserSummaryView } from '../shared/view-types';
import { taskRefColumns } from '../tasks/task-ref.query';

export interface ReassignmentRequestView {
  readonly id: string;
  readonly task: TaskRefView;
  readonly project: ProjectRefView;
  readonly status: ReassignmentStatus;
  readonly reason: string;
  readonly requestedBy: UserSummaryView;
  readonly ownerAtRequest: UserSummaryView | null;
  readonly suggested: UserSummaryView | null;
  readonly decidedBy: UserSummaryView | null;
  readonly decidedAt: string | null;
  readonly decisionNote: string | null;
  readonly newOwner: UserSummaryView | null;
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

async function loadRequests(db: DatabaseExecutor, where: SQL): Promise<ReassignmentRequestView[]> {
  const rows = await db
    .select({
      request: taskReassignmentRequests,
      task: taskRefColumns,
      project: {
        id: projects.id,
        reference: projects.reference,
        name: projects.name,
        colorIndex: projects.colorIndex,
      },
    })
    .from(taskReassignmentRequests)
    .innerJoin(tasks, eq(tasks.id, taskReassignmentRequests.taskId))
    .innerJoin(projects, eq(projects.id, taskReassignmentRequests.projectId))
    .where(where)
    .orderBy(desc(taskReassignmentRequests.createdAt));
  const people = await loadUserSummaries(
    db,
    rows.flatMap(({ request }) => [
      request.requestedByUserId,
      request.ownerAtRequestUserId,
      request.suggestedUserId,
      request.decidedByUserId,
      request.newOwnerUserId,
    ]),
  );
  return rows.map(({ request, task, project }) => ({
    id: request.id,
    task,
    project,
    status: request.status,
    reason: request.reason,
    requestedBy: pickUser(people, request.requestedByUserId) ?? FORMER_MEMBER,
    ownerAtRequest: pickUser(people, request.ownerAtRequestUserId),
    suggested: pickUser(people, request.suggestedUserId),
    decidedBy: pickUser(people, request.decidedByUserId),
    decidedAt: request.decidedAt?.toISOString() ?? null,
    decisionNote: request.decisionNote,
    newOwner: pickUser(people, request.newOwnerUserId),
    createdAt: request.createdAt.toISOString(),
    version: request.version,
  }));
}

/** Every reassignment request on a task, newest first. Callers check task access first. */
export function listTaskReassignments(db: DatabaseExecutor, taskId: string) {
  return loadRequests(db, eq(taskReassignmentRequests.taskId, taskId));
}

export async function findReassignmentRequest(
  db: DatabaseExecutor,
  requestId: string,
): Promise<ReassignmentRequestView | null> {
  const [view] = await loadRequests(db, eq(taskReassignmentRequests.id, requestId));
  return view ?? null;
}
