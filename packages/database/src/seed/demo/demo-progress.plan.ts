import type { TaskStatus } from '@lintel/domain';
import type { DemoBlocker, DemoProgress } from './demo-projects';

export interface DemoTaskRow {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly ownerUserId: string | null;
  readonly plannedStartDate: string | null;
  readonly dueDate: string | null;
  readonly requiresReview: boolean;
  readonly milestoneId: string | null;
  readonly parentTaskId: string | null;
}

export interface DemoTaskState {
  readonly task: DemoTaskRow;
  readonly status: TaskStatus;
  readonly blocker: DemoBlocker | null;
}

/**
 * Decides each task's status "as of today": past work is done except the
 * chosen overdue tasks, current work is in progress, in review or blocked.
 * Overdue picks avoid milestones that are already due, so a single late task
 * reads as "at risk" rather than a missed milestone.
 */
export function planDemoProgress(
  tasks: readonly DemoTaskRow[],
  milestoneDueDates: ReadonlyMap<string, string>,
  progress: DemoProgress,
  today: string,
): DemoTaskState[] {
  const isPast = (task: DemoTaskRow) => task.dueDate !== null && task.dueDate < today;
  const isCurrent = (task: DemoTaskRow) =>
    task.plannedStartDate !== null &&
    task.plannedStartDate <= today &&
    task.dueDate !== null &&
    task.dueDate >= today;
  const milestoneNotDue = (task: DemoTaskRow) =>
    task.milestoneId === null || (milestoneDueDates.get(task.milestoneId) ?? today) >= today;
  const pastTopLevel = tasks
    .filter((task) => isPast(task) && task.parentTaskId === null && task.ownerUserId !== null)
    .sort((a, b) => (b.dueDate ?? '').localeCompare(a.dueDate ?? ''));
  const overdue = new Set(
    [...pastTopLevel.filter(milestoneNotDue), ...pastTopLevel.filter((t) => !milestoneNotDue(t))]
      .slice(0, progress.overdue)
      .map((task) => task.id),
  );
  const startable = tasks.filter((task) => task.parentTaskId === null && task.ownerUserId !== null);
  const current = startable.filter(isCurrent);
  const upcoming = startable.filter((task) => !isPast(task) && !isCurrent(task));
  const blocked = new Map<string, DemoBlocker>();
  progress.blockers.forEach((blocker, index) => {
    const task = current[index] ?? upcoming[index - current.length];
    if (task) blocked.set(task.id, blocker);
  });
  const inReview = new Set(
    current
      .filter((task) => task.requiresReview && !blocked.has(task.id))
      .slice(0, progress.inReview)
      .map((task) => task.id),
  );
  return tasks.map((task): DemoTaskState => {
    const blocker = blocked.get(task.id) ?? null;
    if (blocker) return { task, status: 'blocked', blocker };
    if (overdue.has(task.id)) return { task, status: 'in_progress', blocker: null };
    if (isPast(task)) return { task, status: 'done', blocker: null };
    if (inReview.has(task.id)) return { task, status: 'in_review', blocker: null };
    if (isCurrent(task) && task.ownerUserId !== null) {
      return { task, status: 'in_progress', blocker: null };
    }
    return { task, status: task.ownerUserId ? 'ready' : 'draft', blocker: null };
  });
}
