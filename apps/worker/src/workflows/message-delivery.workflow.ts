import { ActivityFailure, proxyActivities } from '@temporalio/workflow';
import type { WorkerActivities } from '../activities';
import { DATABASE_ACTIVITY, MESSAGE_ACTIVITY } from './activity-options';
import type { MessageDeliveryRequest } from './workflow-contract';

const { recordMessageFailure } = proxyActivities<WorkerActivities>(DATABASE_ACTIVITY);
const { deliverMessage } = proxyActivities<WorkerActivities>(MESSAGE_ACTIVITY);

export type MessageDeliveryOutcome = Awaited<ReturnType<WorkerActivities['deliverMessage']>>;

/**
 * Sends one notification's SMS or immediate email. Every attempt is recorded
 * by the activity; retryable provider failures are retried by Temporal (six
 * attempts), after which the delivery is recorded as failed.
 */
export async function messageDeliveryWorkflow(
  request: MessageDeliveryRequest,
): Promise<MessageDeliveryOutcome> {
  try {
    return await deliverMessage(request.notificationId, request.channel);
  } catch (error) {
    if (!(error instanceof ActivityFailure)) throw error;
    const reason = error.cause instanceof Error ? error.cause.message : error.message;
    return recordMessageFailure(
      request.notificationId,
      request.channel,
      `Gave up after retries: ${reason}`,
    );
  }
}
