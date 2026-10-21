import type { BackgroundStores } from '@lintel/application';
import type { DatabaseExecutor } from '../client';
import { DailyOperationsRepository } from './daily-operations.repository';
import { EmailDigestRepository } from './email-digest.repository';
import { FollowUpRepository } from './follow-up.repository';
import { LeaveImpactRepository } from './leave-impact.repository';
import { MessageDeliveryRepository } from './message-delivery.repository';
import { OutboxRelayRepository } from './outbox-relay.repository';
import { PushDeliveryRepository } from './push-delivery.repository';
import { WorkflowRunRepository } from './workflow-run.repository';

/** Worker-only repositories bound to one executor (the pool or a transaction). */
export function createBackgroundStores(executor: DatabaseExecutor): BackgroundStores {
  return {
    outbox: new OutboxRelayRepository(executor),
    workflowRuns: new WorkflowRunRepository(executor),
    followUps: new FollowUpRepository(executor),
    leaveImpact: new LeaveImpactRepository(executor),
    pushDeliveries: new PushDeliveryRepository(executor),
    operations: new DailyOperationsRepository(executor),
    messageDeliveries: new MessageDeliveryRepository(executor),
    emailDigests: new EmailDigestRepository(executor),
  };
}
