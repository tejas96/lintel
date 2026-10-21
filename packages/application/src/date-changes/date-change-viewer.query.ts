import { type Actor, checkDateChangeRequest, type DateChangeStatus } from '@lintel/domain';
import { NotFoundError, toCalendarDate } from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { ApplicationStores } from '../common/unit-of-work';
import { mayDecideReassignment } from '../reassignments/reassignment-deciders';
import { loadTaskForActor } from '../tasks/task-loader';

type Stores = Pick<ApplicationStores, 'access' | 'tasks' | 'dateChanges'>;

export interface DateChangeViewerState {
  readonly userId: string;
  /** May ask for a new date for this task right now. */
  readonly canRequest: boolean;
  /** Why not, when the viewer works on the task but cannot ask (e.g. one is already open). */
  readonly requestUnavailableReason: string | null;
  readonly managesProject: boolean;
  readonly managerUserId: string | null;
  readonly ownerUserId: string | null;
}

interface RequestLike {
  readonly status: DateChangeStatus;
  readonly requestedBy: { readonly id: string };
}

/** Adds what this viewer may do with each request: decide (never their own) or withdraw. */
export function withDateChangeActions<T extends RequestLike>(
  views: readonly T[],
  viewer: Pick<
    DateChangeViewerState,
    'userId' | 'managesProject' | 'managerUserId' | 'ownerUserId'
  >,
): (T & { viewerCanDecide: boolean; viewerCanWithdraw: boolean })[] {
  const project = { ...viewer, canManage: viewer.managesProject };
  return views.map((view) => {
    const open = view.status === 'open';
    const own = view.requestedBy.id === viewer.userId;
    return {
      ...view,
      viewerCanDecide:
        open && !own && mayDecideReassignment(project, viewer.userId, view.requestedBy.id),
      viewerCanWithdraw: open && own,
    };
  });
}

/** What the viewer may do about a task's dates. Missing and hidden tasks answer 404. */
export class DateChangeViewerQuery {
  constructor(private readonly stores: Stores) {}

  async forTask(actor: Actor, taskId: string, today: string): Promise<DateChangeViewerState> {
    const loaded = await loadTaskForActor(this.stores, actor, taskId, false);
    const open = await this.stores.dateChanges.openForTask(taskId);
    const check = checkDateChangeRequest(
      {
        taskStatus: loaded.task.status,
        ownerUserId: loaded.task.ownerUserId,
        collaboratorUserIds: loaded.collaboratorUserIds,
        currentDueDate: null,
        hasOpenRequest: open !== null,
      },
      {
        requesterUserId: actor.userId,
        reason: 'preview',
        proposedStartDate: null,
        proposedDueDate: toCalendarDate(today),
        today: toCalendarDate(today),
      },
    );
    return {
      userId: actor.userId,
      canRequest: check.allowed,
      requestUnavailableReason:
        check.allowed || check.problem === 'forbidden' ? null : check.reason,
      managesProject: loaded.access.canManage,
      managerUserId: loaded.access.managerUserId,
      ownerUserId: loaded.access.ownerUserId,
    };
  }

  /** For one request: the viewer must see its project; returns the task to load. */
  async forRequest(
    actor: Actor,
    requestId: string,
    today: string,
  ): Promise<DateChangeViewerState & { readonly taskId: string }> {
    const request = await this.stores.dateChanges.find(requestId);
    if (!request) throw new NotFoundError('New-date request');
    await new ProjectAccessService(this.stores.access).requireView(
      actor,
      request.projectId,
      'New-date request',
    );
    return { ...(await this.forTask(actor, request.taskId, today)), taskId: request.taskId };
  }
}
