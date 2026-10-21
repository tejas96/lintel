import type { Blocker, TaskDetail } from '@lintel/api-contracts';

/**
 * Offer "Start" only where the server would let work begin: its `transitions`
 * allow moving the task to in progress, or it already is and the viewer is
 * the owner or a collaborator (reviewers and managers only look).
 */
export function canBeginWork(task: TaskDetail, viewerId: string): boolean {
  if (task.transitions.some((option) => option.to === 'in_progress' && option.allowed)) {
    return true;
  }
  if (task.status !== 'in_progress') return false;
  return task.owner?.id === viewerId || task.collaborators.some((person) => person.id === viewerId);
}

/** Statuses from which "Start" moves a task to in progress. */
export function canStartFrom(status: TaskDetail['status']): boolean {
  return status === 'ready' || status === 'changes_requested';
}

export function isClosed(task: Pick<TaskDetail, 'status'>): boolean {
  return task.status === 'done' || task.status === 'cancelled';
}

/**
 * Blockers have their own flow (category, reason, who it waits on), so the
 * server's "blocked" transition is offered as "Report a blocker". A task that
 * is already blocked can take another blocker.
 */
export function canReportBlocker(task: TaskDetail, viewerId: string): boolean {
  if (task.status === 'blocked') {
    // Another blocker on a blocked task: the owner, a collaborator or a manager.
    return task.viewerCanEdit || task.collaborators.some((person) => person.id === viewerId);
  }
  return task.transitions.some((option) => option.to === 'blocked' && option.allowed);
}

/** The server's reasons when a blocker can't be reported right now. */
export function blockerRefusal(task: TaskDetail, viewerId: string): readonly string[] {
  if (canReportBlocker(task, viewerId)) return [];
  return task.transitions.find((option) => option.to === 'blocked')?.reasons ?? [];
}

/** Resolving is for the manager, whoever raised the blocker, or whoever it waits on. */
export function canResolveBlocker(task: TaskDetail, blocker: Blocker, viewerId: string): boolean {
  return (
    task.viewerCanManage || blocker.raisedBy.id === viewerId || blocker.waitingOn?.id === viewerId
  );
}
