import { wouldCreateDependencyCycle } from '@lintel/domain';
import { ForbiddenError, NotFoundError, ValidationFailedError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { OperationsDependencies } from './operations-context';
import { isParticipant, type LoadedTask, loadTaskForActor } from './task-loader';
import { quoted, recordTaskChange } from './task-records';
import { assertTaskOpen } from './task-validation';

function assertManager(loaded: LoadedTask, what: string): void {
  if (!loaded.relation.canManage) {
    throw new ForbiddenError(`Only the project manager can change ${what}.`);
  }
}

/** Prerequisites and checklist items: the structure of a task's work. */
export class TaskStructureCommands {
  constructor(private readonly deps: OperationsDependencies) {}

  async addDependency(
    context: RequestContext,
    taskId: string,
    dependsOnTaskId: string,
  ): Promise<void> {
    await this.deps.uow.transaction(async (stores) => {
      const loaded = await loadTaskForActor(stores, context.actor, taskId, false);
      assertManager(loaded, 'prerequisites');
      const { task } = loaded;
      const field = 'dependsOnTaskId';
      if (dependsOnTaskId === task.id) {
        throw new ValidationFailedError('A task cannot depend on itself.', [
          { field, message: 'Choose another task.' },
        ]);
      }
      await stores.tasks.lockProject(task.projectId);
      const prerequisite = await stores.tasks.find(dependsOnTaskId);
      if (!prerequisite || prerequisite.projectId !== task.projectId) {
        throw new ValidationFailedError('Prerequisites must come from the same project.', [
          { field, message: 'Choose a task of this project.' },
        ]);
      }
      const edge = { taskId: task.id, dependsOnTaskId };
      const graph = await stores.tasks.dependencyGraph(task.projectId);
      if (wouldCreateDependencyCycle(graph.edges, edge)) {
        throw new ValidationFailedError(
          `That would create a loop: ${quoted(prerequisite.title)} already waits on ${quoted(task.title)}, directly or through other tasks.`,
          [{ field, message: 'Prerequisites cannot form a loop.' }],
        );
      }
      if (!(await stores.tasks.addDependency(edge, context.actor.userId))) return;
      await recordTaskChange(stores.records, context, task, {
        action: 'task.dependency_added',
        summary: `${quoted(task.title)} now waits on ${quoted(prerequisite.title)}.`,
        after: { dependsOnTaskId },
      });
    });
  }

  async removeDependency(
    context: RequestContext,
    taskId: string,
    dependsOnTaskId: string,
  ): Promise<void> {
    await this.deps.uow.transaction(async (stores) => {
      const loaded = await loadTaskForActor(stores, context.actor, taskId, false);
      assertManager(loaded, 'prerequisites');
      await stores.tasks.lockProject(loaded.task.projectId);
      const removed = await stores.tasks.removeDependency({ taskId, dependsOnTaskId });
      if (!removed) throw new NotFoundError('Prerequisite');
      await recordTaskChange(stores.records, context, loaded.task, {
        action: 'task.dependency_removed',
        summary: `Removed a prerequisite from ${quoted(loaded.task.title)}.`,
        before: { dependsOnTaskId },
      });
    });
  }

  async addChecklistItem(
    context: RequestContext,
    taskId: string,
    item: { label: string; isRequired: boolean },
  ): Promise<void> {
    await this.deps.uow.transaction(async (stores) => {
      const loaded = await loadTaskForActor(stores, context.actor, taskId, true);
      assertManager(loaded, 'the checklist');
      assertTaskOpen(loaded.task, 'the checklist');
      const [created] = await stores.taskItems.addChecklistItems(taskId, [item]);
      await recordTaskChange(stores.records, context, loaded.task, {
        action: 'task.checklist_item_added',
        summary: `Added “${item.label}” to the checklist of ${quoted(loaded.task.title)}.`,
        after: { checklistItemId: created?.id ?? null, label: item.label },
      });
    });
  }

  /** Owner, collaborators and managers tick items off. Returns the task ID. */
  async toggleChecklistItem(
    context: RequestContext,
    itemId: string,
    completed: boolean,
  ): Promise<string> {
    const now = this.deps.clock.now();
    return this.deps.uow.transaction(async (stores) => {
      const item = await stores.taskItems.findChecklistItem(itemId);
      if (!item) throw new NotFoundError('Checklist item');
      const loaded = await loadTaskForActor(
        stores,
        context.actor,
        item.taskId,
        true,
        'Checklist item',
      );
      if (!isParticipant(loaded.relation)) {
        throw new ForbiddenError('Only the owner, a collaborator or a manager can tick items off.');
      }
      assertTaskOpen(loaded.task, 'the checklist');
      if ((item.completedAt !== null) === completed) return item.taskId;
      await stores.taskItems.setChecklistItemCompletion(
        itemId,
        completed ? { at: now, byUserId: context.actor.userId } : null,
      );
      await recordTaskChange(stores.records, context, loaded.task, {
        action: completed ? 'task.checklist_item_completed' : 'task.checklist_item_reopened',
        summary: `${completed ? 'Ticked off' : 'Reopened'} “${item.label}”.`,
        after: { checklistItemId: itemId, completed },
      });
      return item.taskId;
    });
  }

  async removeChecklistItem(context: RequestContext, itemId: string): Promise<string> {
    return this.deps.uow.transaction(async (stores) => {
      const item = await stores.taskItems.findChecklistItem(itemId);
      if (!item) throw new NotFoundError('Checklist item');
      const loaded = await loadTaskForActor(
        stores,
        context.actor,
        item.taskId,
        true,
        'Checklist item',
      );
      assertManager(loaded, 'the checklist');
      assertTaskOpen(loaded.task, 'the checklist');
      await stores.taskItems.removeChecklistItem(itemId);
      await recordTaskChange(stores.records, context, loaded.task, {
        action: 'task.checklist_item_removed',
        summary: `Removed “${item.label}” from the checklist.`,
        before: { checklistItemId: itemId, label: item.label },
      });
      return item.taskId;
    });
  }
}
