import type {
  BlockerFacts,
  DailyOperationsStore,
  DeliverableReviewFacts,
  FollowUpStore,
  LeaveImpactStore,
  LeaveRequestFacts,
  LeaveTaskImpactFact,
  OutboxRecord,
  OutboxRelayStore,
  OutboxRetry,
  PendingHandoverFact,
  ProjectRiskFacts,
  TaskDeadlineFacts,
  TaskReviewFacts,
  WorkflowRunRecord,
  WorkflowRunStore,
} from '@lintel/application';
import type { Capability, MilestoneHealth } from '@lintel/domain';

export class FakeFollowUpStore implements FollowUpStore {
  readonly deadlines = new Map<string, TaskDeadlineFacts>();
  readonly taskReviews = new Map<string, TaskReviewFacts>();
  readonly deliverableReviews = new Map<string, DeliverableReviewFacts>();
  readonly blockers = new Map<string, BlockerFacts>();
  readonly capabilityHolders = new Map<Capability, string[]>();

  async taskDeadline(taskId: string) {
    return this.deadlines.get(taskId) ?? null;
  }
  async taskReview(taskId: string) {
    return this.taskReviews.get(taskId) ?? null;
  }
  async deliverableReview(versionId: string) {
    return this.deliverableReviews.get(versionId) ?? null;
  }
  async blocker(blockerId: string) {
    return this.blockers.get(blockerId) ?? null;
  }
  async activeUserIdsWithCapability(capability: Capability) {
    return this.capabilityHolders.get(capability) ?? [];
  }
}

export class FakeLeaveImpactStore implements LeaveImpactStore {
  readonly requests = new Map<string, LeaveRequestFacts>();
  readonly tasksByOwner = new Map<string, LeaveTaskImpactFact[]>();
  readonly handovers = new Map<string, PendingHandoverFact[]>();

  async leaveRequest(id: string) {
    return this.requests.get(id) ?? null;
  }
  async openTasksOwnedBy(userId: string) {
    return this.tasksByOwner.get(userId) ?? [];
  }
  async handoversNotApplied(id: string) {
    return this.handovers.get(id) ?? [];
  }
}

export interface CompletedEvent {
  readonly eventId: string;
  readonly runs: readonly WorkflowRunRecord[];
  readonly note: string | null;
}

/** In-memory outbox. `claimDue` returns pending rows in insertion order. */
export class FakeOutboxRelayStore implements OutboxRelayStore {
  readonly pending: OutboxRecord[] = [];
  readonly completed: CompletedEvent[] = [];
  readonly retries: { eventId: string; retry: OutboxRetry }[] = [];

  async claimDue(limit: number) {
    return this.pending.splice(0, limit);
  }
  async complete(eventId: string, runs: readonly WorkflowRunRecord[], note: string | null) {
    this.completed.push({ eventId, runs, note });
  }
  async scheduleRetry(eventId: string, retry: OutboxRetry) {
    this.retries.push({ eventId, retry });
  }
}

export class FakeWorkflowRunStore implements WorkflowRunStore {
  readonly runs: WorkflowRunRecord[] = [];
  tasksWithoutRuns: string[] = [];

  async record(run: WorkflowRunRecord) {
    this.runs.push(run);
  }
  async openTasksWithoutDeadlineWorkflow(_prefix: string, limit: number) {
    return this.tasksWithoutRuns.slice(0, limit);
  }
}

export class FakeDailyOperationsStore implements DailyOperationsStore {
  projects: ProjectRiskFacts[] = [];
  readonly recorded = new Map<string, MilestoneHealth>();
  readonly existingNotifications = new Set<string>();

  async activeProjectRisks() {
    return this.projects;
  }
  async lastRecordedMilestoneHealth(ids: readonly string[]) {
    return new Map([...this.recorded].filter(([id]) => ids.includes(id)));
  }
  async notificationExists(recipientUserId: string, dedupeKey: string) {
    return this.existingNotifications.has(`${recipientUserId}|${dedupeKey}`);
  }
}
