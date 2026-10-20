/**
 * Names, IDs and argument shapes shared by the outbox relay and the workflow
 * code. This file is bundled into the Temporal workflow sandbox, so it must
 * not import anything.
 */
export const WORKFLOW_TYPES = {
  taskDeadline: 'taskDeadlineWorkflow',
  reviewFollowUp: 'reviewFollowUpWorkflow',
  blockerFollowUp: 'blockerFollowUpWorkflow',
  leaveReassessment: 'leaveReassessmentWorkflow',
  notificationDelivery: 'notificationDeliveryWorkflow',
  dailyOperations: 'dailyOperationsWorkflow',
  periodicRewards: 'periodicRewardEvaluationWorkflow',
} as const;

export type WorkflowTypeName = (typeof WORKFLOW_TYPES)[keyof typeof WORKFLOW_TYPES];

export const SIGNALS = {
  /** The task's due date, owner or priority changed: reload the plan. */
  scheduleChanged: 'scheduleChanged',
  /** The task was completed or cancelled: stop reminding. */
  taskClosed: 'taskClosed',
  /** The deliverable version was reviewed: stop following up. */
  reviewDecided: 'reviewDecided',
  /** The blocker was resolved: stop following up. */
  blockerResolved: 'blockerResolved',
} as const;

/** Idempotent workflow IDs derived from the business record. */
export const WORKFLOW_IDS = {
  taskDeadlinePrefix: 'task-deadline:',
  taskDeadline: (taskId: string) => `task-deadline:${taskId}`,
  taskReview: (taskId: string, submittedAt: string) => `review:task:${taskId}:${submittedAt}`,
  deliverableReview: (versionId: string) => `review:deliverable:${versionId}`,
  blocker: (blockerId: string) => `blocker:${blockerId}`,
  leave: (leaveRequestId: string) => `leave:${leaveRequestId}`,
  notification: (notificationId: string) => `notification:${notificationId}`,
} as const;

export interface ScheduleChangedSignal {
  readonly dueDate?: string | null;
  readonly reason?: string;
}

/** What a deadline workflow carries into its next run after continue-as-new. */
export interface DeadlineCarryOver {
  readonly dueDate: string | null;
  readonly sentStepKeys: readonly string[];
}

export type ReviewSubject =
  | { readonly type: 'task'; readonly taskId: string; readonly submittedAt: string }
  | { readonly type: 'deliverable'; readonly versionId: string };

export type DeadlineWorkflowOutcome = 'task_closed' | 'all_steps_sent' | 'no_due_date';

/** `resolved`: decided, unblocked or gone before every stage ran. */
export type FollowUpWorkflowOutcome = 'resolved' | 'completed';
