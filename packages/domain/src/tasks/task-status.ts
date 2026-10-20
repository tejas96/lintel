export const TASK_STATUSES = [
  'draft',
  'ready',
  'in_progress',
  'blocked',
  'in_review',
  'changes_requested',
  'done',
  'cancelled',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  draft: 'Draft',
  ready: 'Ready',
  in_progress: 'In progress',
  blocked: 'Blocked',
  in_review: 'In review',
  changes_requested: 'Changes requested',
  done: 'Done',
  cancelled: 'Cancelled',
};

/** Statuses in which work is still owed. */
export const OPEN_TASK_STATUSES: readonly TaskStatus[] = [
  'draft',
  'ready',
  'in_progress',
  'blocked',
  'in_review',
  'changes_requested',
];

export function isOpenTaskStatus(status: TaskStatus): boolean {
  return OPEN_TASK_STATUSES.includes(status);
}

/**
 * Every legal move between statuses. Guards in task-transition.policy.ts add
 * the business conditions (owner set, checklist done, reviewer, and so on).
 */
export const TASK_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  draft: ['ready', 'cancelled'],
  ready: ['in_progress', 'blocked', 'draft', 'cancelled'],
  in_progress: ['blocked', 'in_review', 'done', 'ready', 'cancelled'],
  blocked: ['in_progress', 'ready', 'cancelled'],
  in_review: ['done', 'changes_requested', 'in_progress'],
  changes_requested: ['in_progress', 'blocked', 'cancelled'],
  done: ['in_progress'],
  cancelled: ['draft'],
};

export function isLegalTaskTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from].includes(to);
}
