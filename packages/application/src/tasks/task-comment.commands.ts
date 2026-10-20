import type { Actor } from '@lintel/domain';
import { ForbiddenError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { OperationsDependencies, OperationsStores } from './operations-context';
import { isParticipant, type LoadedTask, loadTaskForActor } from './task-loader';

/** Task participants and project members take part in the discussion. */
function canDiscuss(loaded: LoadedTask, actor: Actor): boolean {
  return (
    isParticipant(loaded.relation) ||
    loaded.relation.isReviewer ||
    loaded.access.projectRole !== null ||
    loaded.access.managerUserId === actor.userId
  );
}

async function requireDiscussion(
  stores: Pick<OperationsStores, 'access' | 'tasks'>,
  actor: Actor,
  taskId: string,
): Promise<LoadedTask> {
  const loaded = await loadTaskForActor(stores, actor, taskId, false);
  if (!canDiscuss(loaded, actor)) {
    throw new ForbiddenError('Only project members can read and write comments on this task.');
  }
  return loaded;
}

export class TaskCommentCommands {
  constructor(private readonly deps: OperationsDependencies) {}

  /** Checks the actor may read the comments (404 when hidden, 403 when not a member). */
  async authorizeRead(actor: Actor, taskId: string): Promise<void> {
    await requireDiscussion(this.deps.uow.stores, actor, taskId);
  }

  async add(context: RequestContext, taskId: string, body: string): Promise<{ id: string }> {
    return this.deps.uow.transaction(async (stores) => {
      const loaded = await requireDiscussion(stores, context.actor, taskId);
      const comment = await stores.taskItems.addComment(taskId, context.actor.userId, body);
      await stores.records.appendActivity({
        projectId: loaded.task.projectId,
        taskId,
        actorUserId: context.actor.userId,
        type: 'task.commented',
        summary: `Commented on “${loaded.task.title}”.`,
        payload: { commentId: comment.id },
      });
      return comment;
    });
  }
}
