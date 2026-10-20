/** An outbox row claimed by the relay. Payloads are the JSON written by `RecordStore.enqueueEvent`. */
export interface OutboxRecord {
  readonly id: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: Date;
  readonly attempts: number;
}

/** A durable workflow started (or signalled) for a business record. */
export interface WorkflowRunRecord {
  readonly workflowType: string;
  readonly workflowId: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly sourceEventId: string | null;
  /** True when the workflow received a signal (signal or signal-with-start). */
  readonly signalled: boolean;
}

export interface OutboxRetry {
  readonly attempts: number;
  readonly retryAt: Date;
  readonly error: string;
}

/**
 * The relay side of the transactional outbox. Several worker instances may
 * relay at once: claimed rows stay locked until the claiming transaction ends.
 */
export interface OutboxRelayStore {
  /**
   * Locks up to `limit` unprocessed rows whose `available_at` has passed,
   * oldest first, skipping rows another relay holds. Only meaningful inside
   * a transaction.
   */
  claimDue(limit: number): Promise<OutboxRecord[]>;
  /** Records the workflow runs and marks the event processed, atomically. */
  complete(
    eventId: string,
    runs: readonly WorkflowRunRecord[],
    note: string | null,
    at: Date,
  ): Promise<void>;
  /** Keeps the event pending until `retryAt` and remembers why it failed. */
  scheduleRetry(eventId: string, retry: OutboxRetry): Promise<void>;
}

/** Support and recovery record of durable workflows. */
export interface WorkflowRunStore {
  record(run: WorkflowRunRecord, at: Date): Promise<void>;
  /** Open tasks with a due date that have never had a deadline workflow. */
  openTasksWithoutDeadlineWorkflow(workflowIdPrefix: string, limit: number): Promise<string[]>;
}
