import type { PushResult } from '@lintel/application';

/**
 * Multi-device progress is kept in `provider_message_id` as
 * "deviceId=messageId;deviceId=messageId". A retried attempt skips devices
 * that already received the message, so nobody gets the same push twice.
 */
export function parseSentDevices(progress: string | null): Map<string, string> {
  const sent = new Map<string, string>();
  if (!progress) return sent;
  for (const entry of progress.split(';')) {
    const separator = entry.indexOf('=');
    if (separator <= 0) continue;
    sent.set(entry.slice(0, separator), entry.slice(separator + 1));
  }
  return sent;
}

export function formatSentDevices(sent: ReadonlyMap<string, string>): string | null {
  if (sent.size === 0) return null;
  return [...sent].map(([deviceId, messageId]) => `${deviceId}=${messageId}`).join(';');
}

export interface DeviceOutcome {
  readonly deviceId: string;
  readonly result: PushResult;
}

export type DeliveryDecision =
  | { readonly kind: 'retry'; readonly reason: string }
  | {
      readonly kind: 'finish';
      readonly status: 'sent' | 'failed' | 'skipped';
      readonly reason: string | null;
    };

function reasons(outcomes: readonly DeviceOutcome[]): string {
  const unique = new Set(
    outcomes.flatMap(({ result }) =>
      result.outcome === 'sent' ? [] : [`${result.outcome}: ${result.reason}`],
    ),
  );
  return [...unique].join('; ').slice(0, 500);
}

/**
 * Decides the delivery row from this attempt's per-device results.
 * Retryable provider failures win (Temporal retries the activity); then any
 * device that received it means "sent"; a provider that is not configured
 * (the development log provider) means "skipped", never "sent".
 */
export function decideDelivery(
  sent: ReadonlyMap<string, string>,
  outcomes: readonly DeviceOutcome[],
): DeliveryDecision {
  const retryable = outcomes.filter(({ result }) => result.outcome === 'retryable_failure');
  if (retryable.length > 0) return { kind: 'retry', reason: reasons(retryable) };
  const failures = outcomes.filter(({ result }) => result.outcome !== 'sent');
  if (sent.size > 0) {
    return {
      kind: 'finish',
      status: 'sent',
      reason: failures.length > 0 ? reasons(failures) : null,
    };
  }
  if (outcomes.length === 0) {
    return { kind: 'finish', status: 'skipped', reason: 'No active device.' };
  }
  const notConfigured = outcomes.filter(({ result }) => result.outcome === 'not_configured');
  if (notConfigured.length === outcomes.length) {
    const first = notConfigured[0]?.result;
    const reason = first && first.outcome !== 'sent' ? first.reason : 'Push is not configured.';
    return { kind: 'finish', status: 'skipped', reason };
  }
  return { kind: 'finish', status: 'failed', reason: reasons(failures) };
}
