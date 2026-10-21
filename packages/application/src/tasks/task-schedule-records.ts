import { domainEvent } from '@lintel/domain';
import type { RequestContext } from '../common/request-context';
import type { OperationsStores } from './operations-context';
import type { TaskRecord } from './task.store';

/** "2026-11-12 11:00", "2026-11-12" or "no date", for notices and history. */
export function deadlineText(task: Pick<TaskRecord, 'dueDate' | 'dueTime'>): string {
  if (!task.dueDate) return 'no date';
  return task.dueTime ? `${task.dueDate} ${task.dueTime}` : task.dueDate;
}

/** Asks the deadline workflow to reload its plan from the task as it is now. */
export async function enqueueDeadlineReload(
  stores: Pick<OperationsStores, 'records'>,
  after: TaskRecord,
): Promise<void> {
  await stores.records.enqueueEvent(
    domainEvent('TaskScheduleChanged', 'task', after.id, {
      taskId: after.id,
      projectId: after.projectId,
      dueDate: after.dueDate,
      dueTime: after.dueTime,
    }),
  );
}

/** History row plus outbox event; the baseline due date never changes. */
export async function recordScheduleChange(
  stores: Pick<OperationsStores, 'records' | 'tasks'>,
  context: RequestContext,
  before: TaskRecord,
  after: TaskRecord,
  reason: string,
): Promise<void> {
  await stores.tasks.recordScheduleChange({
    taskId: before.id,
    previousDueDate: before.dueDate,
    newDueDate: after.dueDate,
    previousDueTime: before.dueTime,
    newDueTime: after.dueTime,
    reason,
    changedByUserId: context.actor.userId,
  });
  await enqueueDeadlineReload(stores, after);
}
