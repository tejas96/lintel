import type {
  NewScopeChange,
  ScopeStageFact,
  StoredScopeChangeCancellation,
  StoredScopeChangeNewTask,
} from '@lintel/application';
import { asc, eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { projectStages, scopeChangeNewTasks, scopeChangeTaskCancellations, tasks } from '../schema';

/** Stores the tasks a proposal adds and cancels next to the proposal itself. */
export async function insertScopeAdditions(
  db: DatabaseExecutor,
  scopeChangeId: string,
  change: Pick<NewScopeChange, 'newTasks' | 'cancellations'>,
): Promise<void> {
  if (change.newTasks.length > 0) {
    await db
      .insert(scopeChangeNewTasks)
      .values(change.newTasks.map((task, position) => ({ scopeChangeId, position, ...task })));
  }
  if (change.cancellations.length > 0) {
    await db
      .insert(scopeChangeTaskCancellations)
      .values(change.cancellations.map((cancellation) => ({ scopeChangeId, ...cancellation })));
  }
}

export async function loadScopeStages(
  db: DatabaseExecutor,
  projectId: string,
): Promise<ScopeStageFact[]> {
  return db
    .select({ id: projectStages.id, name: projectStages.name, status: projectStages.status })
    .from(projectStages)
    .where(eq(projectStages.projectId, projectId))
    .orderBy(asc(projectStages.position));
}

export async function loadScopeNewTasks(
  db: DatabaseExecutor,
  scopeChangeId: string,
): Promise<StoredScopeChangeNewTask[]> {
  const rows = await db
    .select()
    .from(scopeChangeNewTasks)
    .where(eq(scopeChangeNewTasks.scopeChangeId, scopeChangeId))
    .orderBy(asc(scopeChangeNewTasks.position));
  return rows.map(({ scopeChangeId: _change, position: _position, ...row }) => row);
}

export async function loadScopeCancellations(
  db: DatabaseExecutor,
  scopeChangeId: string,
): Promise<StoredScopeChangeCancellation[]> {
  return db
    .select({
      id: scopeChangeTaskCancellations.id,
      taskId: scopeChangeTaskCancellations.taskId,
      statusAtProposal: scopeChangeTaskCancellations.statusAtProposal,
      taskTitle: tasks.title,
    })
    .from(scopeChangeTaskCancellations)
    .innerJoin(tasks, eq(tasks.id, scopeChangeTaskCancellations.taskId))
    .where(eq(scopeChangeTaskCancellations.scopeChangeId, scopeChangeId))
    .orderBy(asc(tasks.number));
}

export async function linkScopeCreatedTask(
  db: DatabaseExecutor,
  newTaskId: string,
  taskId: string,
): Promise<void> {
  await db
    .update(scopeChangeNewTasks)
    .set({ createdTaskId: taskId })
    .where(eq(scopeChangeNewTasks.id, newTaskId));
}

export async function settleScopeCancellation(
  db: DatabaseExecutor,
  cancellationId: string,
  outcome: { readonly appliedAt: Date } | { readonly skipReason: string },
): Promise<void> {
  await db
    .update(scopeChangeTaskCancellations)
    .set(
      'appliedAt' in outcome
        ? { appliedAt: outcome.appliedAt }
        : { skipReason: outcome.skipReason },
    )
    .where(eq(scopeChangeTaskCancellations.id, cancellationId));
}
