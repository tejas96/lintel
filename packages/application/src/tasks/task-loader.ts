import type { Actor, TaskActorRelation } from '@lintel/domain';
import { NotFoundError } from '@lintel/shared';
import { type ProjectAccess, ProjectAccessService } from '../access/project-access.service';
import type { OperationsStores } from './operations-context';
import type { TaskRecord } from './task.store';
import { buildDecisionFacts, type TaskDecisionFacts, taskActorRelation } from './task-decision';

export interface LoadedTask {
  readonly task: TaskRecord;
  readonly access: ProjectAccess;
  readonly relation: TaskActorRelation;
  readonly collaboratorUserIds: readonly string[];
}

type LoaderStores = Pick<OperationsStores, 'access' | 'tasks'>;

/**
 * Loads a task the actor may see (missing and hidden both answer 404) with
 * the actor's relation to it. `lock` holds the row for the transaction;
 * `entity` names what the caller looked up, so a hidden task reads as missing.
 */
export async function loadTaskForActor(
  stores: LoaderStores,
  actor: Actor,
  taskId: string,
  lock: boolean,
  entity = 'Task',
): Promise<LoadedTask> {
  const task = lock ? await stores.tasks.findForUpdate(taskId) : await stores.tasks.find(taskId);
  if (!task) throw new NotFoundError(entity);
  const access = await new ProjectAccessService(stores.access).requireView(
    actor,
    task.projectId,
    entity,
  );
  const collaboratorUserIds = await stores.tasks.collaboratorIds(task.id);
  return {
    task,
    access,
    collaboratorUserIds,
    relation: taskActorRelation(actor, task, collaboratorUserIds, access),
  };
}

export async function loadDecisionFacts(
  stores: LoaderStores,
  loaded: LoadedTask,
): Promise<TaskDecisionFacts> {
  const inputs = await stores.tasks.decisionInputs(loaded.task.id);
  return buildDecisionFacts(loaded.task, inputs, loaded.relation);
}

export function isParticipant(relation: TaskActorRelation): boolean {
  return relation.isTaskOwner || relation.isCollaborator || relation.canManage;
}
