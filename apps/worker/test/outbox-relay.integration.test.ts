import type {
  WorkflowScheduler,
  WorkflowSignalRequest,
  WorkflowStartRequest,
} from '@lintel/application';
import { type DatabaseConnection, DrizzleUnitOfWork, schema } from '@lintel/database';
import { LogPushProvider, TemporalWorkflowScheduler } from '@lintel/integrations';
import { systemClock } from '@lintel/shared';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import type { WorkflowBundle } from '@temporalio/worker';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createActivities, OrganizationContext } from '../src/activities';
import { silentLogger } from '../src/observability/worker-logger';
import { OutboxRelay } from '../src/relay/outbox-relay';
import { withNoopMaintenance } from '../src/testing/noop-maintenance';
import { connectTestDatabase, FixtureFactory } from './support/database';
import {
  bundleTestWorkflows,
  connectTestEnvironment,
  createTestWorker,
  eventually,
  TEMPORAL_ADDRESS,
  TEMPORAL_NAMESPACE,
  uniqueTaskQueue,
} from './support/temporal';

/** Records starts and holds each one briefly, so concurrent relays overlap in time. */
class SlowRecordingScheduler implements WorkflowScheduler {
  readonly started: string[] = [];
  async start(request: WorkflowStartRequest) {
    await new Promise((done) => setTimeout(done, 30));
    this.started.push(request.workflowId);
  }
  async signalWithStart(request: WorkflowStartRequest) {
    this.started.push(request.workflowId);
  }
  async signal(_request: WorkflowSignalRequest) {
    return false;
  }
  async checkHealth() {
    return true;
  }
}

describe('outbox relay against PostgreSQL and Temporal', () => {
  let env: TestWorkflowEnvironment;
  let bundle: WorkflowBundle;
  let database: DatabaseConnection;
  let fixtures: FixtureFactory;
  const eventIds: string[] = [];

  beforeAll(async () => {
    env = await connectTestEnvironment();
    bundle = await bundleTestWorkflows();
    database = connectTestDatabase();
    fixtures = new FixtureFactory(database);
  });

  afterAll(async () => {
    if (eventIds.length > 0) {
      await database.db
        .delete(schema.workflowRuns)
        .where(inArray(schema.workflowRuns.sourceEventId, eventIds));
      await database.db
        .delete(schema.outboxEvents)
        .where(inArray(schema.outboxEvents.id, eventIds));
    }
    await fixtures?.cleanUp();
    await database?.close();
    await env?.teardown();
  });

  async function enqueue(eventType: string, payload: Record<string, unknown>): Promise<string> {
    const [row] = await database.db
      .insert(schema.outboxEvents)
      .values({ eventType, aggregateType: 'test', aggregateId: 'test', payload })
      .returning({ id: schema.outboxEvents.id });
    if (!row) throw new Error('Could not insert an outbox event.');
    eventIds.push(row.id);
    return row.id;
  }

  async function outboxRow(id: string) {
    const [row] = await database.db
      .select()
      .from(schema.outboxEvents)
      .where(eq(schema.outboxEvents.id, id));
    return row;
  }

  function relayWith(scheduler: WorkflowScheduler, batchSize = 50) {
    const uow = new DrizzleUnitOfWork(database.db);
    return new OutboxRelay(
      { uow, scheduler, clock: systemClock, logger: silentLogger },
      { batchSize, idleDelayMs: 100 },
    );
  }

  it('relays a NotificationCreated event to a real workflow that delivers the push', async () => {
    const taskQueue = uniqueTaskQueue('relay');
    const scheduler = new TemporalWorkflowScheduler({
      address: TEMPORAL_ADDRESS,
      namespace: TEMPORAL_NAMESPACE,
      taskQueue,
    });
    const recipient = await fixtures.user('Relay Fixture');
    await fixtures.device(recipient, `relay-token-${recipient}`);
    const { notificationId, deliveryId } = await fixtures.pushNotification(recipient, {
      status: 'pending',
    });
    const eventId = await enqueue('NotificationCreated', {
      notificationId,
      recipientId: recipient,
    });
    const unknownId = await enqueue('ProjectCreated', { projectId: 'p1', createdBy: recipient });
    const malformedId = await enqueue('TaskBlocked', { taskId: 't1' });

    const uow = new DrizzleUnitOfWork(database.db);
    const activities = createActivities(
      ...withNoopMaintenance({
        uow,
        clock: systemClock,
        push: new LogPushProvider({ log: () => undefined }),
        scheduler,
        organization: new OrganizationContext(uow.stores.settings, systemClock, {
          smsConfigured: false,
        }),
        logger: silentLogger,
      }),
    );
    const worker = await createTestWorker(env, { taskQueue, bundle, activities });
    await worker.runUntil(async () => {
      const result = await relayWith(scheduler).processBatch();
      expect(result.claimed).toBeGreaterThanOrEqual(3);
      await eventually(async () =>
        expect((await fixtures.pushDelivery(deliveryId))?.status).toBe('skipped'),
      );
    });
    await scheduler.close();

    expect((await outboxRow(eventId))?.processedAt).toBeInstanceOf(Date);
    const [run] = await database.db
      .select()
      .from(schema.workflowRuns)
      .where(eq(schema.workflowRuns.workflowId, `notification:${notificationId}`));
    expect(run).toMatchObject({
      workflowType: 'notificationDeliveryWorkflow',
      subjectType: 'notification',
      subjectId: notificationId,
      sourceEventId: eventId,
    });
    const unknown = await outboxRow(unknownId);
    expect(unknown?.processedAt).toBeInstanceOf(Date);
    expect(unknown?.lastError).toContain('No workflow handles ProjectCreated');
    const malformed = await outboxRow(malformedId);
    expect(malformed?.processedAt).toBeNull();
    expect(malformed?.attempts).toBe(1);
    expect(malformed?.lastError).toContain('blockerId');
    expect(malformed?.availableAt.getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it('lets two relays run at once without handling any event twice', async () => {
    const ids = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        enqueue('NotificationCreated', {
          notificationId: `concurrency-${index}`,
          recipientId: 'x',
        }),
      ),
    );
    const scheduler = new SlowRecordingScheduler();
    const [first, second] = await Promise.all([
      relayWith(scheduler, 10).processBatch(),
      relayWith(scheduler, 10).processBatch(),
    ]);
    expect(first.claimed + second.claimed).toBe(20);
    expect(first.claimed).toBe(10);
    expect(second.claimed).toBe(10);
    expect(new Set(scheduler.started).size).toBe(20);
    const rows = await database.db
      .select({ processedAt: schema.outboxEvents.processedAt })
      .from(schema.outboxEvents)
      .where(inArray(schema.outboxEvents.id, ids));
    expect(rows.every((row) => row.processedAt instanceof Date)).toBe(true);
  });
});
