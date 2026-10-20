import { ActivityFailure, proxyActivities, sleep } from '@temporalio/workflow';
import type { WorkerActivities } from '../activities';
import { DATABASE_ACTIVITY, PUSH_ACTIVITY } from './activity-options';

const { planPushDelivery, recordPushFailure } =
  proxyActivities<WorkerActivities>(DATABASE_ACTIVITY);
const { deliverPush } = proxyActivities<WorkerActivities>(PUSH_ACTIVITY);

export type NotificationDeliveryOutcome = Awaited<ReturnType<WorkerActivities['deliverPush']>>;

/**
 * Delivers one notification's push channel. A delivery deferred by quiet
 * hours sleeps until `not_before`. Retryable provider failures are retried by
 * Temporal (six attempts); after that the delivery is recorded as failed.
 */
export async function notificationDeliveryWorkflow(
  notificationId: string,
): Promise<NotificationDeliveryOutcome> {
  const plan = await planPushDelivery(notificationId);
  if (plan.state === 'missing') return 'missing';
  if (plan.state === 'finished') return 'already_finished';
  if (plan.delayMs > 0) await sleep(plan.delayMs);
  try {
    return await deliverPush(notificationId);
  } catch (error) {
    if (!(error instanceof ActivityFailure)) throw error;
    const reason = error.cause instanceof Error ? error.cause.message : error.message;
    return recordPushFailure(notificationId, `Gave up after retries: ${reason}`);
  }
}
