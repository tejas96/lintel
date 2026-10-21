import { type Actor, checkReassignmentRequest, type ReassignmentStatus } from '@lintel/domain';
import { NotFoundError } from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { ApplicationStores } from '../common/unit-of-work';
import { loadTaskForActor } from '../tasks/task-loader';

type Stores = Pick<ApplicationStores, 'access' | 'tasks' | 'reassignments'>;

export interface ReassignmentViewerState {
  readonly userId: string;
  /** May ask for this task to be reassigned right now. */
  readonly canRequest: boolean;
  /** Why not, when the viewer works on the task but cannot ask (e.g. one is already open). */
  readonly requestUnavailableReason: string | null;
  /** Manages the task's project, so may decide requests made by others. */
  readonly managesProject: boolean;
}

/** A request as read models return it, before the viewer's actions are added. */
interface RequestLike {
  readonly status: ReassignmentStatus;
  readonly requestedBy: { readonly id: string };
}

/** Adds what this viewer may do with each request: decide (never their own) or withdraw. */
export function withReassignmentActions<T extends RequestLike>(
  views: readonly T[],
  viewer: Pick<ReassignmentViewerState, 'userId' | 'managesProject'>,
): (T & { viewerCanDecide: boolean; viewerCanWithdraw: boolean })[] {
  return views.map((view) => {
    const open = view.status === 'open';
    const own = view.requestedBy.id === viewer.userId;
    return {
      ...view,
      viewerCanDecide: open && !own && viewer.managesProject,
      viewerCanWithdraw: open && own,
    };
  });
}

/** What the viewer may do about reassigning a task. Missing and hidden tasks answer 404. */
export class ReassignmentViewerQuery {
  constructor(private readonly stores: Stores) {}

  async forTask(actor: Actor, taskId: string): Promise<ReassignmentViewerState> {
    const loaded = await loadTaskForActor(this.stores, actor, taskId, false);
    const open = await this.stores.reassignments.openForTask(taskId);
    const check = checkReassignmentRequest(
      {
        taskStatus: loaded.task.status,
        ownerUserId: loaded.task.ownerUserId,
        collaboratorUserIds: loaded.collaboratorUserIds,
        hasOpenRequest: open !== null,
      },
      { requesterUserId: actor.userId, reason: 'preview', suggestedUserId: null },
    );
    return {
      userId: actor.userId,
      canRequest: check.allowed,
      requestUnavailableReason:
        check.allowed || check.problem === 'forbidden' ? null : check.reason,
      managesProject: loaded.access.canManage,
    };
  }

  /** For one request: the viewer must see its project; returns the task to load. */
  async forRequest(
    actor: Actor,
    requestId: string,
  ): Promise<ReassignmentViewerState & { readonly taskId: string }> {
    const request = await this.stores.reassignments.find(requestId);
    if (!request) throw new NotFoundError('Reassignment request');
    await new ProjectAccessService(this.stores.access).requireView(
      actor,
      request.projectId,
      'Reassignment request',
    );
    return { ...(await this.forTask(actor, request.taskId)), taskId: request.taskId };
  }
}
