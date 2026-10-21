import type { EmailDigestRecord } from '@lintel/application';
import { type EmailDigestPlan, planEmailDigest } from '@lintel/domain';
import { type CalendarDate, toCalendarDate } from '@lintel/shared';
import { ApplicationFailure } from '@temporalio/common';
import { composeDigestEmail } from '../channels/digest-email';
import type { ActivityDependencies } from './activity-dependencies';
import { type MessageChannelDependencies, RETRYABLE_MESSAGE_FAILURE } from './channel-dependencies';

export interface EmailDigestRun {
  /** The business day (studio timezone) the digests cover. */
  readonly digestDate: string;
  readonly userIds: readonly string[];
}

export type EmailDigestResult = 'sent' | 'failed' | 'skipped' | 'empty' | 'already_finished';

const DIGEST_STATUS = {
  sent: 'sent',
  permanent_failure: 'failed',
  not_configured: 'skipped',
} as const;

/** Activities of `emailDigestWorkflow`. */
export function createEmailDigestActivities(
  deps: ActivityDependencies,
  channels: MessageChannelDependencies,
) {
  const store = () => deps.uow.stores.background.emailDigests;

  /** Sends the claimed digest (attempt N) and finishes it with every email it covers. */
  async function sendClaimed(input: {
    digest: EmailDigestRecord;
    digestDate: CalendarDate;
    plan: EmailDigestPlan;
    to: string;
    recipientName: string;
    deliveryIds: readonly string[];
  }): Promise<EmailDigestResult> {
    const { digest } = input;
    const attempt = digest.attempts + 1;
    await store().startDigestAttempt(digest.id, attempt, channels.email.name, deps.clock.now());
    const settings = await deps.organization.settings();
    const result = await channels.email.send(
      composeDigestEmail({
        digestId: digest.id,
        digestDate: input.digestDate,
        plan: input.plan,
        to: input.to,
        recipientName: input.recipientName,
        studioName: settings.name,
        webBaseUrl: channels.webBaseUrl,
      }),
    );
    if (result.outcome === 'retryable_failure') {
      await store().recordRetryableDigestAttempt(
        digest.id,
        attempt,
        result.reason,
        deps.clock.now(),
      );
      throw ApplicationFailure.retryable(
        `Digest will be retried: ${result.reason}`,
        RETRYABLE_MESSAGE_FAILURE,
      );
    }
    const status = DIGEST_STATUS[result.outcome];
    const completed = await deps.uow.transaction((stores) =>
      stores.background.emailDigests.completeDigest({
        digestId: digest.id,
        attempt,
        status,
        outcome: result.outcome,
        providerMessageId: result.outcome === 'sent' ? result.providerMessageId : null,
        error: result.outcome === 'sent' ? null : result.reason,
        deliveryIds: input.deliveryIds,
        at: deps.clock.now(),
      }),
    );
    return completed ? status : 'already_finished';
  }

  return {
    /** Today in the business timezone, and everyone with emails held for a digest. */
    async planEmailDigests(): Promise<EmailDigestRun> {
      const [digestDate, userIds] = await Promise.all([
        deps.organization.today(),
        store().recipientsWithHeldEmails(),
      ]);
      return { digestDate, userIds };
    },

    /**
     * Sends one person's digest for the day. Idempotent: at most one digest
     * per person and day (a re-run finds it sent), attempt rows are keyed by
     * number, and the Message-ID is stable. Nothing held means nothing sent.
     */
    async sendEmailDigest(userId: string, digestDay: string): Promise<EmailDigestResult> {
      const digestDate: CalendarDate = toCalendarDate(digestDay);
      const held = await store().heldEmails(userId);
      if (!held || held.items.length === 0) return 'empty';
      const deliveryIds = held.items.map((item) => item.deliveryId);
      const { recipient } = held;
      if (!recipient.active || !recipient.email) {
        const reason = recipient.active
          ? 'No email address on file.'
          : 'The recipient is no longer active.';
        await store().skipHeldEmails(deliveryIds, reason);
        return 'skipped';
      }
      const plan = planEmailDigest(held.items);
      if (!plan) return 'empty';
      const digest = await store().claimDigest(userId, digestDate, plan.total);
      if (digest.status !== 'pending') return 'already_finished';
      return sendClaimed({
        digest,
        digestDate,
        plan,
        to: recipient.email,
        recipientName: recipient.fullName,
        deliveryIds,
      });
    },

    /** After the last retry: the digest is marked failed; its emails wait for the next one. */
    async recordDigestFailure(userId: string, digestDay: string, reason: string): Promise<void> {
      await store().abandonDigest(userId, toCalendarDate(digestDay), reason.slice(0, 500));
    },
  };
}
