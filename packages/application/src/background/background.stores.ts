import type { DailyOperationsStore } from './daily-operations.store';
import type { FollowUpStore } from './follow-up.store';
import type { LeaveImpactStore } from './leave-impact.store';
import type { OutboxRelayStore, WorkflowRunStore } from './outbox-relay.store';
import type { PushDeliveryStore } from './push-delivery.store';

/** Persistence used only by the background worker (outbox relay and Temporal activities). */
export interface BackgroundStores {
  readonly outbox: OutboxRelayStore;
  readonly workflowRuns: WorkflowRunStore;
  readonly followUps: FollowUpStore;
  readonly leaveImpact: LeaveImpactStore;
  readonly pushDeliveries: PushDeliveryStore;
  readonly operations: DailyOperationsStore;
}
