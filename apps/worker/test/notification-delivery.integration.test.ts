import type { PushProvider } from '@lintel/application';
import { type DatabaseConnection, DrizzleUnitOfWork } from '@lintel/database';
import { LogPushProvider } from '@lintel/integrations';
import { systemClock } from '@lintel/shared';
import type { WorkflowHandle } from '@temporalio/client';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import type { WorkflowBundle } from '@temporalio/worker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createActivities, OrganizationContext } from '../src/activities';
import { silentLogger } from '../src/observability/worker-logger';
import { ScriptedPushProvider } from '../src/testing/fake-push';
import { FakeWorkflowScheduler } from '../src/testing/fake-world';
import { notificationDeliveryWorkflow } from '../src/workflows/notification-delivery.workflow';
import { connectTestDatabase, FixtureFactory } from './support/database';
import {
  bundleTestWorkflows,
  connectTestEnvironment,
  createTestWorker,
  terminateAll,
  uniqueTaskQueue,
  uniqueWorkflowId,
} from './support/temporal';

describe('notificationDeliveryWorkflow with real activities and database', () => {
  let env: TestWorkflowEnvironment;
  let bundle: WorkflowBundle;
  let database: DatabaseConnection;
  let fixtures: FixtureFactory;
  const handles: WorkflowHandle[] = [];

  beforeAll(async () => {
    env = await connectTestEnvironment();
    bundle = await bundleTestWorkflows();
    database = connectTestDatabase();
    fixtures = new FixtureFactory(database);
  });

  afterAll(async () => {
    await terminateAll(handles);
    await fixtures?.cleanUp();
    await database?.close();
    await env?.teardown();
  });

  async function deliver(push: PushProvider, notificationId: string): Promise<string> {
    const uow = new DrizzleUnitOfWork(database.db);
    const activities = createActivities({
      uow,
      clock: systemClock,
      push,
      scheduler: new FakeWorkflowScheduler(),
      organization: new OrganizationContext(uow.stores.settings, systemClock, {
        smsConfigured: false,
      }),
      logger: silentLogger,
    });
    const taskQueue = uniqueTaskQueue('delivery');
    const worker = await createTestWorker(env, { taskQueue, bundle, activities });
    return worker.runUntil(async () => {
      const handle = await env.client.workflow.start(notificationDeliveryWorkflow, {
        taskQueue,
        workflowId: uniqueWorkflowId('notification'),
        args: [notificationId],
      });
      handles.push(handle);
      return handle.result();
    });
  }

  it('waits for a deferred delivery, then records the development provider as skipped', async () => {
    const logged: string[] = [];
    const logProvider = new LogPushProvider({ log: (message) => logged.push(message) });
    const recipient = await fixtures.user('Delivery Fixture One');
    await fixtures.device(recipient, `test-token-${recipient}`);
    const notBefore = new Date(Date.now() + 2000);
    const { notificationId, deliveryId } = await fixtures.pushNotification(recipient, {
      status: 'deferred',
      notBefore,
    });

    const startedAt = Date.now();
    expect(await deliver(logProvider, notificationId)).toBe('skipped');
    expect(Date.now()).toBeGreaterThanOrEqual(notBefore.getTime());
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1500);
    expect(await fixtures.pushDelivery(deliveryId)).toMatchObject({
      status: 'skipped',
      attempts: 1,
      lastError: 'Push delivery is not configured in this environment.',
      providerMessageId: null,
      sentAt: null,
    });
    expect(logged).toEqual([expect.stringContaining('[DEVELOPMENT ONLY]')]);

    // Idempotent: delivering again never sends or changes the row.
    expect(await deliver(logProvider, notificationId)).toBe('already_finished');
    expect(logged).toHaveLength(1);
    expect((await fixtures.pushDelivery(deliveryId))?.attempts).toBe(1);
  });

  it('revokes a dead token and records the message ID of the device that received it', async () => {
    const recipient = await fixtures.user('Delivery Fixture Two');
    const deadDevice = await fixtures.device(recipient, `dead-token-${recipient}`);
    const liveDevice = await fixtures.device(recipient, `live-token-${recipient}`);
    const { notificationId, deliveryId } = await fixtures.pushNotification(recipient, {
      status: 'pending',
    });
    const push = new ScriptedPushProvider();
    push.script.set(`dead-token-${recipient}`, [
      { outcome: 'invalid_token', reason: 'messaging/registration-token-not-registered' },
    ]);

    expect(await deliver(push, notificationId)).toBe('sent');
    const row = await fixtures.pushDelivery(deliveryId);
    expect(row).toMatchObject({
      status: 'sent',
      attempts: 1,
      providerMessageId: `${liveDevice}=msg-live-token-${recipient}`,
    });
    expect(row?.sentAt).toBeInstanceOf(Date);
    expect(row?.lastError).toContain('invalid_token');
    const revoked = await fixtures.deviceRow(deadDevice);
    expect(revoked?.revokedAt).toBeInstanceOf(Date);
    expect(revoked?.revokedReason).toContain('registration-token-not-registered');
    expect((await fixtures.deviceRow(liveDevice))?.revokedAt).toBeNull();
  });

  it('retries a retryable provider failure with backoff and then sends', async () => {
    const recipient = await fixtures.user('Delivery Fixture Three');
    await fixtures.device(recipient, `flaky-token-${recipient}`);
    const { notificationId, deliveryId } = await fixtures.pushNotification(recipient, {
      status: 'pending',
    });
    const push = new ScriptedPushProvider();
    push.script.set(`flaky-token-${recipient}`, [
      { outcome: 'retryable_failure', reason: 'messaging/server-unavailable' },
    ]);

    expect(await deliver(push, notificationId)).toBe('sent');
    expect(push.sent).toHaveLength(2);
    expect(await fixtures.pushDelivery(deliveryId)).toMatchObject({
      status: 'sent',
      attempts: 2,
      lastError: null,
    });
  });
});
