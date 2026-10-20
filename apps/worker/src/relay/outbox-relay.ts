import type {
  OutboxRecord,
  OutboxRelayStore,
  UnitOfWork,
  WorkflowRunRecord,
  WorkflowScheduler,
} from '@lintel/application';
import type { Clock } from '@lintel/shared';
import { describeError, type WorkerLogger } from '../observability/worker-logger';
import { routeOutboxEvent, type WorkflowCommand } from './event-routing';
import { outboxRetryAt } from './retry-backoff';

/** The only stores the relay needs (DrizzleUnitOfWork satisfies this). */
export interface RelayStores {
  readonly background: { readonly outbox: OutboxRelayStore };
}

export interface OutboxRelayDependencies {
  readonly uow: UnitOfWork<RelayStores>;
  readonly scheduler: WorkflowScheduler;
  readonly clock: Clock;
  readonly logger: WorkerLogger;
}

export interface OutboxRelayOptions {
  readonly batchSize: number;
  readonly idleDelayMs: number;
  /** Bounds each Temporal call, so claimed rows are never locked indefinitely. */
  readonly dispatchTimeoutMs: number;
}

export const DEFAULT_RELAY_OPTIONS: OutboxRelayOptions = {
  batchSize: 50,
  idleDelayMs: 2000,
  dispatchTimeoutMs: 15_000,
};

/** Rejects when `work` takes longer than `milliseconds` (the call itself is idempotent). */
function withTimeout<T>(work: Promise<T>, milliseconds: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${what} timed out after ${milliseconds} ms`)),
      milliseconds,
    );
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

export interface RelayBatchResult {
  claimed: number;
  processed: number;
  ignored: number;
  failed: number;
}

type EventOutcome = 'processed' | 'ignored' | 'failed';

/**
 * Moves outbox events to Temporal at least once. Each batch is claimed with
 * `FOR UPDATE SKIP LOCKED` inside one transaction, so several worker
 * instances can relay at the same time without handling a row twice.
 * Workflow IDs come from the business record, so a repeated start is a no-op.
 */
export class OutboxRelay {
  private stopping = false;
  private wake: (() => void) | null = null;
  private readonly options: OutboxRelayOptions;

  constructor(
    private readonly deps: OutboxRelayDependencies,
    options: Partial<OutboxRelayOptions> = {},
  ) {
    this.options = { ...DEFAULT_RELAY_OPTIONS, ...options };
  }

  /** Polls until `stop()`; a full batch is followed immediately by the next one. */
  async run(): Promise<void> {
    this.deps.logger.info('Outbox relay started', {
      batchSize: this.options.batchSize,
      idleDelayMs: this.options.idleDelayMs,
    });
    while (!this.stopping) {
      let claimed = 0;
      try {
        const result = await this.processBatch();
        claimed = result.claimed;
        if (claimed > 0) this.deps.logger.info('Outbox batch relayed', { ...result });
      } catch (error) {
        this.deps.logger.error('Outbox batch failed; it will be retried', {
          error: describeError(error),
        });
      }
      if (!this.stopping && claimed < this.options.batchSize) {
        await this.pause(this.options.idleDelayMs);
      }
    }
    this.deps.logger.info('Outbox relay stopped');
  }

  /** Finishes the batch in progress, then stops polling. */
  stop(): void {
    this.stopping = true;
    this.wake?.();
  }

  async processBatch(): Promise<RelayBatchResult> {
    return this.deps.uow.transaction(async (stores) => {
      const outbox = stores.background.outbox;
      const events = await outbox.claimDue(this.options.batchSize);
      const result: RelayBatchResult = {
        claimed: events.length,
        processed: 0,
        ignored: 0,
        failed: 0,
      };
      for (const event of events) {
        const outcome = await this.relayEvent(outbox, event);
        result[outcome] += 1;
      }
      return result;
    });
  }

  private async relayEvent(outbox: OutboxRelayStore, event: OutboxRecord): Promise<EventOutcome> {
    try {
      const route = routeOutboxEvent(event);
      if (route.kind === 'ignore') {
        await outbox.complete(event.id, [], route.note, this.deps.clock.now());
        return 'ignored';
      }
      const { runs, note } = await withTimeout(
        this.dispatch(route.command, event),
        this.options.dispatchTimeoutMs,
        `${route.command.mode} ${route.command.workflowId}`,
      );
      await outbox.complete(event.id, runs, note, this.deps.clock.now());
      return 'processed';
    } catch (error) {
      const attempts = event.attempts + 1;
      const retryAt = outboxRetryAt(this.deps.clock.now(), attempts);
      await outbox.scheduleRetry(event.id, { attempts, retryAt, error: describeError(error) });
      this.deps.logger.warn('Outbox event failed; retry scheduled', {
        eventId: event.id,
        eventType: event.eventType,
        attempts,
        retryAt: retryAt.toISOString(),
        error: describeError(error, 200),
      });
      return 'failed';
    }
  }

  private async dispatch(
    command: WorkflowCommand,
    event: OutboxRecord,
  ): Promise<{ runs: WorkflowRunRecord[]; note: string | null }> {
    const run = (signalled: boolean): WorkflowRunRecord => ({
      workflowType: command.workflowType,
      workflowId: command.workflowId,
      subjectType: command.subject.subjectType,
      subjectId: command.subject.subjectId,
      sourceEventId: event.id,
      signalled,
    });
    const { scheduler } = this.deps;
    switch (command.mode) {
      case 'start':
        await scheduler.start(command);
        return { runs: [run(false)], note: null };
      case 'signalWithStart':
        await scheduler.signalWithStart(command);
        return { runs: [run(true)], note: null };
      case 'signalIfRunning': {
        const delivered = await scheduler.signal(command);
        if (delivered) return { runs: [run(true)], note: null };
        return {
          runs: [],
          note: `${command.workflowId} is not running; ${command.signal} skipped.`,
        };
      }
    }
  }

  private pause(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.wake = null;
        resolve();
      };
      const timer = setTimeout(done, milliseconds);
      this.wake = done;
    });
  }
}
