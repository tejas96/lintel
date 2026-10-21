import type { TaskPriority, TaskStatus } from '@lintel/domain';
import { asc, eq, inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import {
  projectStages,
  scopeChangeNewTasks,
  scopeChangeTaskCancellations,
  tasks,
} from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import type { TaskRefView, UserSummaryView } from '../shared/view-types';
import { loadTaskRefMap, taskRefColumns } from '../tasks/task-ref.query';

export interface ScopeNewTaskView {
  readonly id: string;
  readonly title: string;
  readonly stage: { readonly id: string; readonly name: string } | null;
  readonly plannedStartDate: string | null;
  readonly dueDate: string | null;
  readonly owner: UserSummaryView | null;
  readonly priority: TaskPriority;
  /** The task approval created; null while proposed or when rejected. */
  readonly createdTask: TaskRefView | null;
}

export interface ScopeCancellationView {
  readonly id: string;
  readonly task: TaskRefView;
  readonly statusAtProposal: TaskStatus;
  readonly outcome: 'pending' | 'cancelled' | 'skipped';
  readonly skipReason: string | null;
}

/** The tasks each scope change adds and cancels, keyed by scope change. */
export async function loadScopeAdditionViews(
  db: DatabaseExecutor,
  scopeChangeIds: readonly string[],
): Promise<{
  newTasks: Map<string, ScopeNewTaskView[]>;
  cancellations: Map<string, ScopeCancellationView[]>;
}> {
  const newTasks = new Map<string, ScopeNewTaskView[]>();
  const cancellations = new Map<string, ScopeCancellationView[]>();
  if (scopeChangeIds.length === 0) return { newTasks, cancellations };
  const ids = [...scopeChangeIds];
  const [additionRows, cancellationRows] = await Promise.all([
    db
      .select({ addition: scopeChangeNewTasks, stageName: projectStages.name })
      .from(scopeChangeNewTasks)
      .leftJoin(projectStages, eq(projectStages.id, scopeChangeNewTasks.stageId))
      .where(inArray(scopeChangeNewTasks.scopeChangeId, ids))
      .orderBy(asc(scopeChangeNewTasks.position)),
    db
      .select({ cancellation: scopeChangeTaskCancellations, task: taskRefColumns })
      .from(scopeChangeTaskCancellations)
      .innerJoin(tasks, eq(tasks.id, scopeChangeTaskCancellations.taskId))
      .where(inArray(scopeChangeTaskCancellations.scopeChangeId, ids))
      .orderBy(asc(tasks.number)),
  ]);
  const [owners, created] = await Promise.all([
    loadUserSummaries(
      db,
      additionRows.map(({ addition }) => addition.ownerUserId),
    ),
    loadTaskRefMap(
      db,
      additionRows.map(({ addition }) => addition.createdTaskId),
    ),
  ]);
  for (const { addition, stageName } of additionRows) {
    const list = newTasks.get(addition.scopeChangeId) ?? [];
    list.push({
      id: addition.id,
      title: addition.title,
      stage: addition.stageId && stageName ? { id: addition.stageId, name: stageName } : null,
      plannedStartDate: addition.plannedStartDate,
      dueDate: addition.dueDate,
      owner: pickUser(owners, addition.ownerUserId),
      priority: addition.priority,
      createdTask: addition.createdTaskId ? (created.get(addition.createdTaskId) ?? null) : null,
    });
    newTasks.set(addition.scopeChangeId, list);
  }
  for (const { cancellation, task } of cancellationRows) {
    const list = cancellations.get(cancellation.scopeChangeId) ?? [];
    list.push({
      id: cancellation.id,
      task,
      statusAtProposal: cancellation.statusAtProposal,
      outcome: cancellation.appliedAt
        ? 'cancelled'
        : cancellation.skipReason
          ? 'skipped'
          : 'pending',
      skipReason: cancellation.skipReason,
    });
    cancellations.set(cancellation.scopeChangeId, list);
  }
  return { newTasks, cancellations };
}
