import type {
  OutboxRecord,
  OutboxRelayStore,
  OutboxRetry,
  WorkflowRunRecord,
} from '@lintel/application';
import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { outboxEvents } from '../schema';
import { upsertWorkflowRun } from './workflow-run.repository';

/**
 * Relay side of the transactional outbox. `claimDue` uses
 * `FOR UPDATE SKIP LOCKED`, so several relays never handle the same row.
 */
export class OutboxRelayRepository implements OutboxRelayStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async claimDue(limit: number): Promise<OutboxRecord[]> {
    const rows = await this.db
      .select({
        id: outboxEvents.id,
        eventType: outboxEvents.eventType,
        aggregateType: outboxEvents.aggregateType,
        aggregateId: outboxEvents.aggregateId,
        payload: outboxEvents.payload,
        occurredAt: outboxEvents.occurredAt,
        attempts: outboxEvents.attempts,
      })
      .from(outboxEvents)
      .where(and(isNull(outboxEvents.processedAt), lte(outboxEvents.availableAt, sql`now()`)))
      .orderBy(asc(outboxEvents.occurredAt))
      .limit(limit)
      .for('update', { skipLocked: true });
    return rows;
  }

  async complete(
    eventId: string,
    runs: readonly WorkflowRunRecord[],
    note: string | null,
    at: Date,
  ): Promise<void> {
    // A savepoint inside the relay transaction: a failure here rolls back only this event.
    await this.db.transaction(async (savepoint) => {
      for (const run of runs) await upsertWorkflowRun(savepoint, run, at);
      await savepoint
        .update(outboxEvents)
        .set({ processedAt: at, lastError: note })
        .where(eq(outboxEvents.id, eventId));
    });
  }

  async scheduleRetry(eventId: string, retry: OutboxRetry): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({ attempts: retry.attempts, availableAt: retry.retryAt, lastError: retry.error })
      .where(and(eq(outboxEvents.id, eventId), isNull(outboxEvents.processedAt)));
  }
}
