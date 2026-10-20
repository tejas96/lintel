import type { PushDeliveryFacts, PushDeliveryStore } from '@lintel/application';
import { pushPreviewFor } from '@lintel/domain';
import { ApplicationFailure } from '@temporalio/common';
import type { ActivityDependencies } from './activity-dependencies';
import {
  type DeviceOutcome,
  decideDelivery,
  formatSentDevices,
  parseSentDevices,
} from './push-progress';
import { delayUntil } from './working-time';

export interface PushDeliveryPlan {
  readonly state: 'ready' | 'deferred' | 'finished' | 'missing';
  /** Deferred deliveries wait until `not_before` (the end of quiet hours). */
  readonly delayMs: number;
}

export type PushDeliveryResult = 'sent' | 'failed' | 'skipped' | 'already_finished' | 'missing';

/** Error type Temporal shows when a push attempt is retried. */
export const RETRYABLE_PUSH_FAILURE = 'RetryablePushFailure';

const OPEN_STATUSES: ReadonlySet<string> = new Set(['pending', 'deferred']);

type OpenDelivery = NonNullable<PushDeliveryFacts['delivery']>;

async function sendToDevices(
  deps: ActivityDependencies,
  store: PushDeliveryStore,
  facts: PushDeliveryFacts,
  sent: Map<string, string>,
): Promise<DeviceOutcome[]> {
  const devices = (await store.activeDevices(facts.recipientUserId)).filter(
    (device) => !sent.has(device.id),
  );
  const preview = pushPreviewFor(facts.kind, facts.title, facts.body);
  const outcomes: DeviceOutcome[] = [];
  for (const device of devices) {
    const result = await deps.push.send({
      token: device.token,
      tokenType: device.tokenType,
      title: preview.title,
      body: preview.body,
      linkPath: facts.linkPath,
      collapseKey: `notification:${facts.notificationId}`,
    });
    outcomes.push({ deviceId: device.id, result });
    if (result.outcome === 'sent') sent.set(device.id, result.providerMessageId);
    if (result.outcome === 'invalid_token') {
      await store.revokeDevice(
        device.id,
        `Push provider rejected the token: ${result.reason}`,
        deps.clock.now(),
      );
    }
  }
  return outcomes;
}

async function finishDelivery(
  deps: ActivityDependencies,
  store: PushDeliveryStore,
  delivery: OpenDelivery,
  outcome: {
    status: 'sent' | 'failed' | 'skipped';
    attempts: number;
    sent: ReadonlyMap<string, string>;
    reason: string | null;
  },
): Promise<PushDeliveryResult> {
  const now = deps.clock.now();
  const finished = await store.finish(delivery.id, {
    status: outcome.status,
    attempts: outcome.attempts,
    providerMessageId: formatSentDevices(outcome.sent),
    lastError: outcome.reason,
    sentAt: outcome.status === 'sent' ? now : null,
  });
  return finished ? outcome.status : 'already_finished';
}

/** Activities of `notificationDeliveryWorkflow`. */
export function createPushDeliveryActivities(deps: ActivityDependencies) {
  const store = () => deps.uow.stores.background.pushDeliveries;
  return {
    async planPushDelivery(notificationId: string): Promise<PushDeliveryPlan> {
      const facts = await store().pushDelivery(notificationId);
      const delivery = facts?.delivery;
      if (!delivery) return { state: 'missing', delayMs: 0 };
      if (delivery.status === 'pending') return { state: 'ready', delayMs: 0 };
      if (delivery.status !== 'deferred') return { state: 'finished', delayMs: 0 };
      const now = deps.clock.now();
      return { state: 'deferred', delayMs: delayUntil(delivery.notBefore ?? now, now) };
    },

    /**
     * Sends the push to every active device of the recipient. Idempotent:
     * finished deliveries are skipped, and devices that already received it
     * are skipped on retry. Dead tokens are revoked. A retryable provider
     * failure throws, so Temporal retries with backoff.
     */
    async deliverPush(notificationId: string): Promise<PushDeliveryResult> {
      const pushStore = store();
      const facts = await pushStore.pushDelivery(notificationId);
      const delivery = facts?.delivery;
      if (!facts || !delivery) return 'missing';
      if (!OPEN_STATUSES.has(delivery.status)) return 'already_finished';
      const attempts = delivery.attempts + 1;
      const sent = parseSentDevices(delivery.providerMessageId);
      if (!facts.recipientActive) {
        return finishDelivery(deps, pushStore, delivery, {
          status: 'skipped',
          attempts,
          sent,
          reason: 'The recipient is no longer active.',
        });
      }
      const outcomes = await sendToDevices(deps, pushStore, facts, sent);
      const decision = decideDelivery(sent, outcomes);
      if (decision.kind === 'retry') {
        await pushStore.recordAttempt(delivery.id, {
          attempts,
          lastError: decision.reason,
          providerMessageId: formatSentDevices(sent),
        });
        throw ApplicationFailure.retryable(
          `Push will be retried: ${decision.reason}`,
          RETRYABLE_PUSH_FAILURE,
        );
      }
      return finishDelivery(deps, pushStore, delivery, {
        status: decision.status,
        attempts,
        sent,
        reason: decision.reason,
      });
    },

    /** Called by the workflow once retries are exhausted. */
    async recordPushFailure(notificationId: string, reason: string): Promise<PushDeliveryResult> {
      const pushStore = store();
      const facts = await pushStore.pushDelivery(notificationId);
      const delivery = facts?.delivery;
      if (!delivery) return 'missing';
      if (!OPEN_STATUSES.has(delivery.status)) return 'already_finished';
      const sent = parseSentDevices(delivery.providerMessageId);
      return finishDelivery(deps, pushStore, delivery, {
        status: sent.size > 0 ? 'sent' : 'failed',
        attempts: delivery.attempts,
        sent,
        reason: reason.slice(0, 500),
      });
    },
  };
}
