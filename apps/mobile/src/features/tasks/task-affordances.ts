import type { TaskDetail } from '@lintel/api-contracts';

/**
 * Offer "Start" only where the server would let work begin: the task is
 * already in progress, or its `transitions` allow moving it there.
 */
export function canBeginWork(task: TaskDetail): boolean {
  return (
    task.status === 'in_progress' ||
    task.transitions.some((option) => option.to === 'in_progress' && option.allowed)
  );
}

export function isClosed(task: Pick<TaskDetail, 'status'>): boolean {
  return task.status === 'done' || task.status === 'cancelled';
}
