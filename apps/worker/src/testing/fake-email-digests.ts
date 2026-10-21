import type {
  DigestCompletion,
  DigestRecipient,
  EmailDigestRecord,
  EmailDigestStore,
  HeldDigestEmail,
} from '@lintel/application';
import type { CalendarDate } from '@lintel/shared';

interface DigestRow extends EmailDigestRecord {
  readonly userId: string;
  readonly digestDate: string;
  readonly itemCount: number;
  readonly lastError: string | null;
}

/** In-memory digests over held emails (status `digest`), with the repository's rules. */
export class FakeEmailDigestStore implements EmailDigestStore {
  readonly recipients = new Map<string, DigestRecipient>();
  /** Held emails per person; delivered or skipped ones are removed. */
  readonly held = new Map<string, HeldDigestEmail[]>();
  readonly finished = new Map<string, { status: string; reason: string | null }>();
  readonly digests: DigestRow[] = [];
  readonly attempts: { digestId: string; attempt: number; outcome: string | null }[] = [];

  hold(recipient: DigestRecipient, items: HeldDigestEmail[]): void {
    this.recipients.set(recipient.userId, recipient);
    this.held.set(recipient.userId, [...(this.held.get(recipient.userId) ?? []), ...items]);
  }

  async recipientsWithHeldEmails() {
    return [...this.held].filter(([, items]) => items.length > 0).map(([userId]) => userId);
  }

  async heldEmails(userId: string) {
    const recipient = this.recipients.get(userId);
    if (!recipient) return null;
    return { recipient, items: [...(this.held.get(userId) ?? [])] };
  }

  async claimDigest(userId: string, digestDate: CalendarDate, itemCount: number) {
    const index = this.digests.findIndex(
      (row) => row.userId === userId && row.digestDate === digestDate,
    );
    const existing = this.digests[index];
    if (existing) {
      if (existing.status === 'pending') this.digests[index] = { ...existing, itemCount };
      return existing;
    }
    const row: DigestRow = {
      id: `digest-${this.digests.length + 1}`,
      userId,
      digestDate,
      itemCount,
      status: 'pending',
      attempts: 0,
      lastError: null,
    };
    this.digests.push(row);
    return row;
  }

  async startDigestAttempt(digestId: string, attempt: number) {
    if (!this.attempts.some((row) => row.digestId === digestId && row.attempt === attempt)) {
      this.attempts.push({ digestId, attempt, outcome: null });
    }
  }

  private setAttempt(digestId: string, attempt: number, outcome: string) {
    const row = this.attempts.find(
      (entry) => entry.digestId === digestId && entry.attempt === attempt,
    );
    if (row) row.outcome = outcome;
  }

  private patch(digestId: string, change: Partial<DigestRow>): boolean {
    const index = this.digests.findIndex((row) => row.id === digestId);
    const row = this.digests[index];
    if (row?.status !== 'pending') return false;
    this.digests[index] = { ...row, ...change };
    return true;
  }

  async recordRetryableDigestAttempt(digestId: string, attempt: number, error: string) {
    this.setAttempt(digestId, attempt, 'retryable_failure');
    this.patch(digestId, { attempts: attempt, lastError: error });
  }

  async completeDigest(completion: DigestCompletion) {
    if (
      !this.patch(completion.digestId, { status: completion.status, attempts: completion.attempt })
    ) {
      return false;
    }
    this.setAttempt(completion.digestId, completion.attempt, completion.outcome);
    this.finishDeliveries(completion.deliveryIds, completion.status, completion.error);
    return true;
  }

  async abandonDigest(userId: string, digestDate: CalendarDate, reason: string) {
    const row = this.digests.find(
      (entry) => entry.userId === userId && entry.digestDate === digestDate,
    );
    return row ? this.patch(row.id, { status: 'failed', lastError: reason }) : false;
  }

  async skipHeldEmails(deliveryIds: readonly string[], reason: string) {
    this.finishDeliveries(deliveryIds, 'skipped', reason);
  }

  private finishDeliveries(ids: readonly string[], status: string, reason: string | null) {
    const done = new Set(ids);
    for (const id of ids) this.finished.set(id, { status, reason });
    for (const [userId, items] of this.held) {
      this.held.set(
        userId,
        items.filter((item) => !done.has(item.deliveryId)),
      );
    }
  }
}
