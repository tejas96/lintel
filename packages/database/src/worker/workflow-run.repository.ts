import type { WorkflowRunRecord, WorkflowRunStore } from '@lintel/application';
import { OPEN_TASK_STATUSES } from '@lintel/domain';
import { and, asc, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { tasks, workflowRuns } from '../schema';

/**
 * Inserts or refreshes the support record of a workflow. A later start for
 * the same workflow ID (a new run after the previous one finished) keeps the
 * row and refreshes the signal time when the run was signalled.
 */
export async function upsertWorkflowRun(
  db: DatabaseExecutor,
  run: WorkflowRunRecord,
  at: Date,
): Promise<void> {
  const insert = db.insert(workflowRuns).values({
    workflowType: run.workflowType,
    workflowId: run.workflowId,
    subjectType: run.subjectType,
    subjectId: run.subjectId,
    sourceEventId: run.sourceEventId,
    startedAt: at,
    lastSignalAt: run.signalled ? at : null,
  });
  if (run.signalled) {
    await insert.onConflictDoUpdate({ target: workflowRuns.workflowId, set: { lastSignalAt: at } });
  } else {
    await insert.onConflictDoNothing({ target: workflowRuns.workflowId });
  }
}

export class WorkflowRunRepository implements WorkflowRunStore {
  constructor(private readonly db: DatabaseExecutor) {}

  record(run: WorkflowRunRecord, at: Date): Promise<void> {
    return upsertWorkflowRun(this.db, run, at);
  }

  async openTasksWithoutDeadlineWorkflow(workflowIdPrefix: string, limit: number) {
    const rows = await this.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          inArray(tasks.status, [...OPEN_TASK_STATUSES]),
          isNotNull(tasks.dueDate),
          isNull(tasks.archivedAt),
          sql`not exists (select 1 from ${workflowRuns} where ${workflowRuns.workflowId} = ${workflowIdPrefix}::text || ${tasks.id}::text)`,
        ),
      )
      .orderBy(asc(tasks.dueDate))
      .limit(limit);
    return rows.map((row) => row.id);
  }
}
