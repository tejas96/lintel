import type {
  EmailMessage,
  MessageChannel,
  MessageDeliveryFacts,
  MessageSendResult,
  SmsMessage,
} from '@lintel/application';
import { appLink } from '@lintel/shared';
import { ApplicationFailure } from '@temporalio/common';
import { composeNotificationEmail } from '../channels/notification-email';
import type { ActivityDependencies } from './activity-dependencies';
import {
  deliveryStatusFor,
  type MessageChannelDependencies,
  RETRYABLE_MESSAGE_FAILURE,
} from './channel-dependencies';

export type MessageDeliveryResult = 'sent' | 'failed' | 'skipped' | 'already_finished' | 'missing';

const OPEN_STATUSES: ReadonlySet<string> = new Set(['pending', 'deferred']);

type OpenFacts = MessageDeliveryFacts & {
  readonly delivery: NonNullable<MessageDeliveryFacts['delivery']>;
};

/** Why this person cannot get the message at all (recorded as skipped), or null. */
function recipientProblem(facts: MessageDeliveryFacts, channel: MessageChannel): string | null {
  if (!facts.recipient.active) return 'The recipient is no longer active.';
  if (channel === 'email' && !facts.recipient.email) return 'No email address on file.';
  return null;
}

function providerLabel(channels: MessageChannelDependencies, channel: MessageChannel): string {
  if (channel === 'email') return channels.email.name;
  const template = channels.sms.templateReference;
  return template ? `${channels.sms.name}: ${template}` : channels.sms.name;
}

function smsFor(facts: OpenFacts, channels: MessageChannelDependencies): SmsMessage {
  return {
    phoneE164: facts.recipient.phoneE164,
    link: appLink(channels.webBaseUrl, facts.linkPath),
    reference: facts.delivery.id,
  };
}

async function emailFor(
  deps: ActivityDependencies,
  facts: OpenFacts,
  channels: MessageChannelDependencies,
): Promise<EmailMessage> {
  const settings = await deps.organization.settings();
  return composeNotificationEmail({
    notificationId: facts.notificationId,
    deliveryId: facts.delivery.id,
    kind: facts.kind,
    title: facts.title,
    body: facts.body,
    linkPath: facts.linkPath,
    to: facts.recipient.email ?? '',
    recipientName: facts.recipient.fullName,
    studioName: settings.name,
    webBaseUrl: channels.webBaseUrl,
  });
}

/** Activities of `messageDeliveryWorkflow`: one SMS or immediate email per notification. */
export function createMessageDeliveryActivities(
  deps: ActivityDependencies,
  channels: MessageChannelDependencies,
) {
  const store = () => deps.uow.stores.background.messageDeliveries;

  async function send(facts: OpenFacts, channel: MessageChannel): Promise<MessageSendResult> {
    const problem = recipientProblem(facts, channel);
    if (problem) return { outcome: 'not_configured', reason: problem };
    if (channel === 'sms') return channels.sms.send(smsFor(facts, channels));
    return channels.email.send(await emailFor(deps, facts, channels));
  }

  /** One numbered attempt: the row is written before the provider is called. */
  async function attemptDelivery(facts: OpenFacts, channel: MessageChannel) {
    const deliveryId = facts.delivery.id;
    const attempt = facts.delivery.attempts + 1;
    const provider = providerLabel(channels, channel);
    await store().startAttempt({ deliveryId, channel, attempt, provider, at: deps.clock.now() });
    const unavailable = recipientProblem(facts, channel) !== null;
    const result = await send(facts, channel);
    const status = deliveryStatusFor(result);
    const finished = await store().finishAttempt({
      deliveryId,
      attempt,
      outcome: unavailable ? 'recipient_unavailable' : result.outcome,
      providerMessageId: result.outcome === 'sent' ? result.providerMessageId : null,
      error: result.outcome === 'sent' ? null : result.reason,
      at: deps.clock.now(),
      deliveryStatus: status,
    });
    return { result, status, finished };
  }

  return {
    /**
     * Sends one SMS or email and records the attempt. Idempotent: finished
     * deliveries are left alone, attempt rows are keyed by number, and the
     * email Message-ID is stable. Retryable failures throw so Temporal backs off.
     */
    async deliverMessage(
      notificationId: string,
      channel: MessageChannel,
    ): Promise<MessageDeliveryResult> {
      const facts = await store().messageDelivery(notificationId, channel);
      if (!facts?.delivery) return 'missing';
      if (!OPEN_STATUSES.has(facts.delivery.status)) return 'already_finished';
      const { result, status, finished } = await attemptDelivery(
        { ...facts, delivery: facts.delivery },
        channel,
      );
      if (status === 'pending') {
        const reason = result.outcome === 'sent' ? '' : result.reason;
        throw ApplicationFailure.retryable(
          `${channel.toUpperCase()} will be retried: ${reason}`,
          RETRYABLE_MESSAGE_FAILURE,
        );
      }
      return finished ? status : 'already_finished';
    },

    /** Called by the workflow once retries are exhausted. */
    async recordMessageFailure(
      notificationId: string,
      channel: MessageChannel,
      reason: string,
    ): Promise<MessageDeliveryResult> {
      const facts = await store().messageDelivery(notificationId, channel);
      if (!facts?.delivery) return 'missing';
      if (!OPEN_STATUSES.has(facts.delivery.status)) return 'already_finished';
      const gaveUp = await store().giveUp(facts.delivery.id, reason.slice(0, 500));
      return gaveUp ? 'failed' : 'already_finished';
    },
  };
}
