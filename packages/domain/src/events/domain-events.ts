/**
 * Business events written to the transactional outbox in the same database
 * transaction as the change that caused them. The worker relays them to
 * Temporal; nothing critical relies on in-memory listeners.
 */
export interface DomainEventMap {
  ProjectCreated: { projectId: string; createdBy: string };
  TaskAssigned: { taskId: string; projectId: string; ownerId: string; assignedBy: string };
  TaskScheduleChanged: { taskId: string; projectId: string; dueDate: string | null };
  TaskBlocked: { taskId: string; projectId: string; blockerId: string };
  TaskUnblocked: { taskId: string; projectId: string; blockerId: string };
  TaskCompleted: { taskId: string; projectId: string; completedBy: string };
  TaskSubmittedForReview: { taskId: string; projectId: string; reviewerId: string | null };
  DeliverableSubmitted: { deliverableId: string; versionId: string; projectId: string };
  DeliverableReviewed: { deliverableId: string; versionId: string; decision: string };
  LeaveRequested: { leaveRequestId: string; userId: string };
  LeaveDecided: { leaveRequestId: string; userId: string; status: string };
  UrgentAbsenceRecorded: { leaveRequestId: string; userId: string };
  ScopeChangeDecided: { scopeChangeId: string; projectId: string; status: string };
  NotificationCreated: { notificationId: string; recipientId: string };
  /** An SMS or an immediate email waits to be sent by the worker. */
  NotificationMessageQueued: {
    notificationId: string;
    recipientId: string;
    channel: 'sms' | 'email';
  };
  RewardEvaluated: { evaluationId: string; userId: string | null; status: string };
  MilestoneRewardEvaluated: { milestoneRewardId: string; milestoneId: string; projectId: string };
  MilestoneRewardDecided: { shareId: string; userId: string; status: string };
  RewardChallengeRaised: { challengeId: string; recordKind: string; recordId: string };
  RewardChallengeResolved: { challengeId: string; status: string };
}

export type DomainEventType = keyof DomainEventMap;

export interface DomainEvent<T extends DomainEventType = DomainEventType> {
  readonly type: T;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: DomainEventMap[T];
}

export function domainEvent<T extends DomainEventType>(
  type: T,
  aggregateType: string,
  aggregateId: string,
  payload: DomainEventMap[T],
): DomainEvent<T> {
  return { type, aggregateType, aggregateId, payload };
}
