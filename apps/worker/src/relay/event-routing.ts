import type { OutboxRecord } from '@lintel/application';
import type { DomainEventType } from '@lintel/domain';
import {
  type MessageDeliveryRequest,
  type ReviewSubject,
  SIGNALS,
  WORKFLOW_IDS,
  WORKFLOW_TYPES,
  type WorkflowTypeName,
} from '../workflows/workflow-contract';

export interface RunSubject {
  readonly subjectType: string;
  readonly subjectId: string;
}

interface CommandBase {
  readonly workflowType: WorkflowTypeName;
  readonly workflowId: string;
  readonly subject: RunSubject;
}

/** What the relay asks Temporal to do for one outbox event. */
export type WorkflowCommand =
  | (CommandBase & { readonly mode: 'start'; readonly args: unknown[] })
  | (CommandBase & {
      readonly mode: 'signalWithStart';
      readonly args: unknown[];
      readonly signal: string;
      readonly signalArgs: unknown[];
    })
  /** Signals a running workflow only; never starts one. */
  | (CommandBase & {
      readonly mode: 'signalIfRunning';
      readonly signal: string;
      readonly signalArgs: unknown[];
    });

export type EventRoute =
  | { readonly kind: 'dispatch'; readonly command: WorkflowCommand }
  | { readonly kind: 'ignore'; readonly note: string };

/** The payload cannot be routed. The relay retries it with backoff (fixable by a deploy). */
export class MalformedOutboxEventError extends Error {
  constructor(eventType: string, field: string) {
    super(`${eventType} payload has no usable "${field}".`);
    this.name = 'MalformedOutboxEventError';
  }
}

function requiredText(event: OutboxRecord, field: string): string {
  const value = event.payload[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MalformedOutboxEventError(event.eventType, field);
  }
  return value;
}

function optionalText(event: OutboxRecord, field: string): string | null {
  const value = event.payload[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

const dispatch = (command: WorkflowCommand): EventRoute => ({ kind: 'dispatch', command });

function deadlineReload(event: OutboxRecord): EventRoute {
  const taskId = requiredText(event, 'taskId');
  return dispatch({
    mode: 'signalWithStart',
    workflowType: WORKFLOW_TYPES.taskDeadline,
    workflowId: WORKFLOW_IDS.taskDeadline(taskId),
    args: [taskId],
    signal: SIGNALS.scheduleChanged,
    signalArgs: [{ dueDate: optionalText(event, 'dueDate'), reason: event.eventType }],
    subject: { subjectType: 'task', subjectId: taskId },
  });
}

function startOnce(
  workflowType: WorkflowTypeName,
  workflowId: string,
  args: unknown[],
  subject: RunSubject,
): EventRoute {
  return dispatch({ mode: 'start', workflowType, workflowId, args, subject });
}

function signalIfRunning(
  workflowType: WorkflowTypeName,
  workflowId: string,
  signal: string,
  subject: RunSubject,
): EventRoute {
  return dispatch({
    mode: 'signalIfRunning',
    workflowType,
    workflowId,
    signal,
    signalArgs: [],
    subject,
  });
}

function leaveReassessment(event: OutboxRecord): EventRoute {
  const leaveRequestId = requiredText(event, 'leaveRequestId');
  return startOnce(
    WORKFLOW_TYPES.leaveReassessment,
    WORKFLOW_IDS.leave(leaveRequestId),
    [leaveRequestId],
    { subjectType: 'leave_request', subjectId: leaveRequestId },
  );
}

type RouteBuilder = (event: OutboxRecord) => EventRoute;

const ROUTES: Partial<Record<DomainEventType, RouteBuilder>> = {
  TaskAssigned: deadlineReload,
  TaskScheduleChanged: deadlineReload,
  TaskCompleted: (event) => {
    const taskId = requiredText(event, 'taskId');
    return signalIfRunning(
      WORKFLOW_TYPES.taskDeadline,
      WORKFLOW_IDS.taskDeadline(taskId),
      SIGNALS.taskClosed,
      { subjectType: 'task', subjectId: taskId },
    );
  },
  TaskSubmittedForReview: (event) => {
    const taskId = requiredText(event, 'taskId');
    // The submission time identifies the review round; the outbox row is written with it.
    const submittedAt = optionalText(event, 'submittedAt') ?? event.occurredAt.toISOString();
    const subject: ReviewSubject = { type: 'task', taskId, submittedAt };
    return startOnce(
      WORKFLOW_TYPES.reviewFollowUp,
      WORKFLOW_IDS.taskReview(taskId, submittedAt),
      [subject],
      { subjectType: 'task', subjectId: taskId },
    );
  },
  DeliverableSubmitted: (event) => {
    const versionId = requiredText(event, 'versionId');
    const subject: ReviewSubject = { type: 'deliverable', versionId };
    return startOnce(
      WORKFLOW_TYPES.reviewFollowUp,
      WORKFLOW_IDS.deliverableReview(versionId),
      [subject],
      { subjectType: 'deliverable_version', subjectId: versionId },
    );
  },
  DeliverableReviewed: (event) => {
    const versionId = requiredText(event, 'versionId');
    return signalIfRunning(
      WORKFLOW_TYPES.reviewFollowUp,
      WORKFLOW_IDS.deliverableReview(versionId),
      SIGNALS.reviewDecided,
      { subjectType: 'deliverable_version', subjectId: versionId },
    );
  },
  TaskBlocked: (event) => {
    const blockerId = requiredText(event, 'blockerId');
    return startOnce(WORKFLOW_TYPES.blockerFollowUp, WORKFLOW_IDS.blocker(blockerId), [blockerId], {
      subjectType: 'task_blocker',
      subjectId: blockerId,
    });
  },
  TaskUnblocked: (event) => {
    const blockerId = requiredText(event, 'blockerId');
    return signalIfRunning(
      WORKFLOW_TYPES.blockerFollowUp,
      WORKFLOW_IDS.blocker(blockerId),
      SIGNALS.blockerResolved,
      { subjectType: 'task_blocker', subjectId: blockerId },
    );
  },
  LeaveDecided: (event) => {
    const status = optionalText(event, 'status');
    if (status !== 'approved') {
      return { kind: 'ignore', note: `Leave decision "${status ?? 'unknown'}" needs no workflow.` };
    }
    return leaveReassessment(event);
  },
  UrgentAbsenceRecorded: leaveReassessment,
  NotificationCreated: (event) => {
    const notificationId = requiredText(event, 'notificationId');
    return startOnce(
      WORKFLOW_TYPES.notificationDelivery,
      WORKFLOW_IDS.notification(notificationId),
      [notificationId],
      { subjectType: 'notification', subjectId: notificationId },
    );
  },
  NotificationMessageQueued: (event) => {
    const notificationId = requiredText(event, 'notificationId');
    const channel = requiredText(event, 'channel');
    if (channel !== 'sms' && channel !== 'email') {
      throw new MalformedOutboxEventError(event.eventType, 'channel');
    }
    const request: MessageDeliveryRequest = { notificationId, channel };
    return startOnce(
      WORKFLOW_TYPES.messageDelivery,
      WORKFLOW_IDS.notificationMessage(notificationId, channel),
      [request],
      { subjectType: 'notification', subjectId: notificationId },
    );
  },
};

function isRoutedEventType(eventType: string): eventType is keyof typeof ROUTES {
  return Object.hasOwn(ROUTES, eventType);
}

/** Translates one outbox event into a workflow command. Pure, so it is unit-tested directly. */
export function routeOutboxEvent(event: OutboxRecord): EventRoute {
  const build = isRoutedEventType(event.eventType) ? ROUTES[event.eventType] : undefined;
  if (!build) {
    return { kind: 'ignore', note: `No workflow handles ${event.eventType}; marked processed.` };
  }
  return build(event);
}
