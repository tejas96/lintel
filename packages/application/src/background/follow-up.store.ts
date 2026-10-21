import type {
  Capability,
  DeliverableStatus,
  ProjectCriticality,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';

export interface FollowUpProjectFacts {
  readonly id: string;
  readonly name: string;
  readonly reference: string;
  readonly status: ProjectStatus;
  readonly criticality: ProjectCriticality;
  readonly managerUserId: string;
}

export interface TaskDeadlineFacts {
  readonly taskId: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly plannedStartDate: CalendarDate | null;
  readonly dueDate: CalendarDate | null;
  /** "HH:mm" in the business timezone; null = the end of the working day. */
  readonly dueTime: string | null;
  readonly escalateAfterOverdueDays: number;
  readonly ownerUserId: string | null;
  readonly ownerName: string | null;
  readonly archived: boolean;
  /** Every prerequisite is done or cancelled (true when there are none). */
  readonly prerequisitesDone: boolean;
  readonly project: FollowUpProjectFacts;
}

export interface TaskReviewFacts {
  readonly taskId: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly submittedAt: Date | null;
  readonly reviewerUserId: string | null;
  readonly ownerName: string | null;
  readonly project: FollowUpProjectFacts;
}

export interface DeliverableReviewFacts {
  readonly versionId: string;
  readonly deliverableId: string;
  readonly deliverableName: string;
  readonly versionNumber: number;
  readonly decision: 'pending' | 'approved' | 'changes_requested' | 'rejected';
  readonly deliverableStatus: DeliverableStatus;
  readonly reviewerUserId: string | null;
  readonly submittedAt: Date;
  readonly submittedByName: string | null;
  readonly project: FollowUpProjectFacts;
}

export interface BlockerFacts {
  readonly blockerId: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly category: string;
  readonly reason: string;
  readonly raisedAt: Date;
  readonly resolvedAt: Date | null;
  readonly project: FollowUpProjectFacts;
}

/** Read-only facts the reminder and escalation workflows re-check before notifying. */
export interface FollowUpStore {
  taskDeadline(taskId: string): Promise<TaskDeadlineFacts | null>;
  taskReview(taskId: string): Promise<TaskReviewFacts | null>;
  deliverableReview(versionId: string): Promise<DeliverableReviewFacts | null>;
  blocker(blockerId: string): Promise<BlockerFacts | null>;
  /** Active people whose role currently grants the capability. */
  activeUserIdsWithCapability(capability: Capability): Promise<string[]>;
}
