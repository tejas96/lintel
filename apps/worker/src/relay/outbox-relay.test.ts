import type { OutboxRecord, WorkflowScheduler } from '@lintel/application';
import { fixedClock } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { silentLogger } from '../observability/worker-logger';
import { FakeOutboxRelayStore } from '../testing/fake-background-stores';
import { FakeUnitOfWork, FakeWorkflowScheduler } from '../testing/fake-world';
import { OutboxRelay } from './outbox-relay';
import { MAX_OUTBOX_RETRY_DELAY_SECONDS, outboxRetryDelaySeconds } from './retry-backoff';

const NOW = '2026-11-09T06:00:00.000Z';

function record(id: string, eventType: string, payload: Record<string, unknown>, attempts = 0) {
  const row: OutboxRecord = {
    id,
    eventType,
    aggregateType: 'task',
    aggregateId: 'a',
    payload,
    occurredAt: new Date(NOW),
    attempts,
  };
  return row;
}

function setup() {
  const outbox = new FakeOutboxRelayStore();
  const scheduler = new FakeWorkflowScheduler();
  const uow = new FakeUnitOfWork({ background: { outbox } });
  const relay = new OutboxRelay(
    { uow, scheduler, clock: fixedClock(NOW), logger: silentLogger },
    { batchSize: 50, idleDelayMs: 10 },
  );
  return { outbox, scheduler, uow, relay };
}

describe('outbox retry backoff', () => {
  it('doubles from 2 seconds and caps at one hour', () => {
    expect([1, 2, 3, 4, 10].map(outboxRetryDelaySeconds)).toEqual([2, 4, 8, 16, 1024]);
    expect(outboxRetryDelaySeconds(12)).toBe(MAX_OUTBOX_RETRY_DELAY_SECONDS);
    expect(outboxRetryDelaySeconds(500)).toBe(3600);
    expect(outboxRetryDelaySeconds(0)).toBe(2);
  });
});

describe('outbox relay', () => {
  it('dispatches each event in one transaction and records the workflow run', async () => {
    const { outbox, scheduler, uow, relay } = setup();
    outbox.pending.push(
      record('e1', 'TaskAssigned', { taskId: 't1' }),
      record('e2', 'NotificationCreated', { notificationId: 'n1' }),
    );
    const result = await relay.processBatch();
    expect(result).toEqual({ claimed: 2, processed: 2, ignored: 0, failed: 0 });
    expect(uow.transactions).toBe(1);
    expect(scheduler.calls.map((call) => call.kind)).toEqual(['signalWithStart', 'start']);
    expect(outbox.completed).toEqual([
      {
        eventId: 'e1',
        note: null,
        runs: [
          {
            workflowType: 'taskDeadlineWorkflow',
            workflowId: 'task-deadline:t1',
            subjectType: 'task',
            subjectId: 't1',
            sourceEventId: 'e1',
            signalled: true,
          },
        ],
      },
      expect.objectContaining({
        eventId: 'e2',
        runs: [expect.objectContaining({ signalled: false })],
      }),
    ]);
  });

  it('keeps a failed event with backoff while the rest of the batch proceeds', async () => {
    const { outbox, scheduler, relay } = setup();
    scheduler.failFor.add('task-deadline:t1');
    outbox.pending.push(
      record('e1', 'TaskAssigned', { taskId: 't1' }, 3),
      record('e2', 'TaskBlocked', { taskId: 't2', blockerId: 'b1' }),
    );
    const result = await relay.processBatch();
    expect(result).toMatchObject({ processed: 1, failed: 1 });
    expect(outbox.retries).toEqual([
      {
        eventId: 'e1',
        retry: {
          attempts: 4,
          retryAt: new Date('2026-11-09T06:00:16.000Z'),
          error: 'Error: Temporal unavailable for task-deadline:t1',
        },
      },
    ]);
    expect(outbox.completed.map((done) => done.eventId)).toEqual(['e2']);
  });

  it('retries malformed payloads instead of dropping them', async () => {
    const { outbox, relay } = setup();
    outbox.pending.push(record('e1', 'TaskBlocked', { taskId: 't1' }));
    await relay.processBatch();
    expect(outbox.retries[0]?.retry.error).toContain('blockerId');
    expect(outbox.completed).toEqual([]);
  });

  it('marks unknown types processed with a note and does not start completed workflows', async () => {
    const { outbox, scheduler, relay } = setup();
    scheduler.running.add('blocker:b-running');
    outbox.pending.push(
      record('e1', 'RewardEvaluated', { evaluationId: 'r1' }),
      record('e2', 'TaskCompleted', { taskId: 't-done' }),
      record('e3', 'TaskUnblocked', { taskId: 't1', blockerId: 'b-running' }),
    );
    const result = await relay.processBatch();
    expect(result).toMatchObject({ processed: 2, ignored: 1, failed: 0 });
    expect(scheduler.calls.filter((call) => call.kind !== 'signal')).toEqual([]);
    const [unknown, completed, unblocked] = outbox.completed;
    expect(unknown?.note).toContain('No workflow handles RewardEvaluated');
    expect(completed).toMatchObject({ runs: [], note: expect.stringContaining('not running') });
    expect(unblocked?.runs[0]).toMatchObject({ workflowId: 'blocker:b-running', signalled: true });
  });

  it('gives up on a hung Temporal call and retries the event later', async () => {
    const { outbox } = setup();
    const hungScheduler: WorkflowScheduler = {
      start: () => new Promise<void>(() => undefined),
      signalWithStart: async () => undefined,
      signal: async () => false,
      checkHealth: async () => true,
    };
    const hung = new OutboxRelay(
      {
        uow: new FakeUnitOfWork({ background: { outbox } }),
        scheduler: hungScheduler,
        clock: fixedClock(NOW),
        logger: silentLogger,
      },
      { dispatchTimeoutMs: 20 },
    );
    outbox.pending.push(record('e1', 'NotificationCreated', { notificationId: 'n1' }));
    expect(await hung.processBatch()).toMatchObject({ failed: 1 });
    expect(outbox.retries[0]?.retry.error).toContain('timed out after 20 ms');
  });

  it('stops polling promptly when asked', async () => {
    const { relay } = setup();
    const running = relay.run();
    relay.stop();
    await expect(running).resolves.toBeUndefined();
  });
});
