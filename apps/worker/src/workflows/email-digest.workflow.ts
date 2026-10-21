import { ActivityFailure, proxyActivities } from '@temporalio/workflow';
import type { EmailDigestResult, WorkerActivities } from '../activities';
import { DATABASE_ACTIVITY, MESSAGE_ACTIVITY } from './activity-options';

const { planEmailDigests, recordDigestFailure } =
  proxyActivities<WorkerActivities>(DATABASE_ACTIVITY);
const { sendEmailDigest } = proxyActivities<WorkerActivities>(MESSAGE_ACTIVITY);

export interface EmailDigestOutcome {
  readonly digestDate: string;
  readonly recipients: number;
  readonly sent: number;
  readonly skipped: number;
  readonly empty: number;
  readonly failed: number;
}

/** A few people at a time: polite to the mail server, quick for a studio-sized team. */
const BATCH = 5;

async function sendOne(userId: string, digestDate: string): Promise<EmailDigestResult> {
  try {
    return await sendEmailDigest(userId, digestDate);
  } catch (error) {
    if (!(error instanceof ActivityFailure)) throw error;
    const reason = error.cause instanceof Error ? error.cause.message : error.message;
    await recordDigestFailure(userId, digestDate, `Gave up after retries: ${reason}`);
    return 'failed';
  }
}

/**
 * Run every day by the `lintel-email-digest` Schedule (business timezone):
 * one digest per person with held emails. Nobody with nothing held gets an
 * email; a digest that keeps failing leaves its emails for the next day.
 */
export async function emailDigestWorkflow(): Promise<EmailDigestOutcome> {
  const { digestDate, userIds } = await planEmailDigests();
  const counts = { sent: 0, skipped: 0, empty: 0, failed: 0 };
  for (let start = 0; start < userIds.length; start += BATCH) {
    const batch = userIds.slice(start, start + BATCH);
    const results = await Promise.all(batch.map((userId) => sendOne(userId, digestDate)));
    for (const result of results) {
      if (result === 'sent') counts.sent += 1;
      else if (result === 'failed') counts.failed += 1;
      else if (result === 'skipped') counts.skipped += 1;
      else counts.empty += 1;
    }
  }
  return { digestDate, recipients: userIds.length, ...counts };
}
