import { Notifier } from '@lintel/application';
import { type DatabaseConnection, DrizzleUnitOfWork } from '@lintel/database';
import type { NotificationKind } from '@lintel/domain';
import { systemClock } from '@lintel/shared';
import type { WorkflowHandle } from '@temporalio/client';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import type { WorkflowBundle } from '@temporalio/worker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createActivities, OrganizationContext } from '../src/activities';
import { silentLogger } from '../src/observability/worker-logger';
import { ScriptedEmailSender, ScriptedSmsSender } from '../src/testing/fake-messages';
import { ScriptedPushProvider } from '../src/testing/fake-push';
import { FakeWorkflowScheduler } from '../src/testing/fake-world';
import { withNoopMaintenance } from '../src/testing/noop-maintenance';
import { emailDigestWorkflow } from '../src/workflows/email-digest.workflow';
import { messageDeliveryWorkflow } from '../src/workflows/message-delivery.workflow';
import { ChannelFixtures } from './support/channel-fixtures';
import { connectTestDatabase, FixtureFactory } from './support/database';
import {
  bundleTestWorkflows,
  connectTestEnvironment,
  createTestWorker,
  terminateAll,
  uniqueTaskQueue,
  uniqueWorkflowId,
} from './support/temporal';

describe('SMS and email channels with real activities, database and Temporal', () => {
  let env: TestWorkflowEnvironment;
  let bundle: WorkflowBundle;
  let database: DatabaseConnection;
  let fixtures: FixtureFactory;
  let channels: ChannelFixtures;
  const handles: WorkflowHandle[] = [];
  const notificationIds: string[] = [];

  beforeAll(async () => {
    env = await connectTestEnvironment();
    bundle = await bundleTestWorkflows();
    database = connectTestDatabase();
    fixtures = new FixtureFactory(database);
    channels = new ChannelFixtures(database);
    await channels.ensureOrganization();
  });

  afterAll(async () => {
    await terminateAll(handles);
    await channels?.removeEvents(notificationIds);
    await fixtures?.cleanUp();
    await database?.close();
    await env?.teardown();
  });

  function uow() {
    return new DrizzleUnitOfWork(database.db);
  }

  async function notify(userId: string, kind: NotificationKind, title: string) {
    const stores = uow().stores;
    const notifier = new Notifier(stores.notifications, stores.records, systemClock, {
      timeZone: 'Asia/Kolkata',
      quietHoursStart: '21:00',
      quietHoursEnd: '08:00',
      smsConfigured: true,
      emailConfigured: true,
    });
    await notifier.notify({
      recipientUserId: userId,
      kind,
      title,
      body: `${title}: three tasks need a new owner.`,
      linkPath: '/leave/00000000-0000-0000-0000-000000000001',
      subjectType: 'leave_request',
      subjectId: null,
      dedupeKey: `channels-test:${kind}:${title}:${userId}`,
    });
    const rows = await channels.notificationsOf(userId);
    notificationIds.push(...rows.map((row) => row.id));
    return rows.at(-1)?.id ?? '';
  }

  async function run<T>(
    senders: { sms: ScriptedSmsSender; email: ScriptedEmailSender },
    work: (taskQueue: string) => Promise<T>,
  ): Promise<T> {
    const unitOfWork = uow();
    const activities = createActivities(
      ...withNoopMaintenance({
        uow: unitOfWork,
        clock: systemClock,
        push: new ScriptedPushProvider(),
        scheduler: new FakeWorkflowScheduler(),
        organization: new OrganizationContext(unitOfWork.stores.settings, systemClock, {
          smsConfigured: true,
          emailConfigured: true,
        }),
        logger: silentLogger,
      }),
      { ...senders, webBaseUrl: 'https://studio.example.com' },
    );
    const taskQueue = uniqueTaskQueue('channels');
    const worker = await createTestWorker(env, { taskQueue, bundle, activities });
    return worker.runUntil(() => work(taskQueue));
  }

  async function deliver(taskQueue: string, notificationId: string, channel: 'sms' | 'email') {
    const handle = await env.client.workflow.start(messageDeliveryWorkflow, {
      taskQueue,
      workflowId: uniqueWorkflowId(`message-${channel}`),
      args: [{ notificationId, channel }],
    });
    handles.push(handle);
    return handle.result();
  }

  it('plans SMS and email for an urgent alert and delivers each with one attempt row', async () => {
    const userId = await fixtures.user('Channel Fixture One');
    await channels.contactDetails(userId, 'channel.one@studio.example', false);
    await channels.optIn(userId, ['absence_reassessment'], 'sms');
    await channels.optIn(userId, ['absence_reassessment'], 'email');
    const notificationId = await notify(userId, 'absence_reassessment', 'Ananya is away');

    const planned = await channels.deliveries([notificationId]);
    expect(planned.map((row) => `${row.channel}:${row.status}`)).toEqual([
      'push:skipped',
      'sms:pending',
      'email:pending',
    ]);
    const events = await channels.queuedEvents([notificationId]);
    expect(events.map((event) => `${event.eventType}:${event.payload.channel}`).sort()).toEqual([
      'NotificationMessageQueued:email',
      'NotificationMessageQueued:sms',
    ]);

    const senders = { sms: new ScriptedSmsSender(), email: new ScriptedEmailSender() };
    const results = await run(senders, async (taskQueue) => [
      await deliver(taskQueue, notificationId, 'sms'),
      await deliver(taskQueue, notificationId, 'email'),
    ]);
    expect(results).toEqual(['sent', 'sent']);
    expect(senders.sms.sent[0]?.link).toBe(
      'https://studio.example.com/leave/00000000-0000-0000-0000-000000000001',
    );
    expect(senders.email.sent[0]?.to).toBe('channel.one@studio.example');
    const delivered = await channels.deliveries([notificationId]);
    for (const row of delivered.filter((entry) => entry.channel !== 'push')) {
      expect(row).toMatchObject({ status: 'sent', attempts: 1, lastError: null });
      expect(row.sentAt).toBeInstanceOf(Date);
      const attempts = await channels.attempts(row.id);
      expect(attempts).toHaveLength(1);
      expect(attempts[0]).toMatchObject({ attempt: 1, outcome: 'sent' });
      expect(attempts[0]?.finishedAt).toBeInstanceOf(Date);
    }
  });

  it('retries an SMS outage and keeps a row for every attempt', async () => {
    const userId = await fixtures.user('Channel Fixture Two');
    await channels.optIn(userId, ['absence_reassessment'], 'sms');
    const notificationId = await notify(userId, 'absence_reassessment', 'Rohan is away');
    const senders = { sms: new ScriptedSmsSender(), email: new ScriptedEmailSender() };
    senders.sms.script.push({ outcome: 'retryable_failure', reason: 'MSG91 rate limit reached.' });

    expect(await run(senders, (taskQueue) => deliver(taskQueue, notificationId, 'sms'))).toBe(
      'sent',
    );
    const [sms] = (await channels.deliveries([notificationId])).filter(
      (row) => row.channel === 'sms',
    );
    expect(sms).toMatchObject({ status: 'sent', attempts: 2 });
    const attempts = await channels.attempts(sms?.id ?? '');
    expect(attempts.map((row) => `${row.attempt}:${row.outcome}:${row.error}`)).toEqual([
      '1:retryable_failure:MSG91 rate limit reached.',
      '2:sent:null',
    ]);
  });

  it('holds non-urgent emails for one daily digest and never sends an empty one', async () => {
    const userId = await fixtures.user('Channel Fixture Three');
    const address = 'channel.three@studio.example';
    await channels.contactDetails(userId, address, true);
    await channels.optIn(userId, ['task_assigned', 'review_requested'], 'email');
    const first = await notify(userId, 'task_assigned', 'Kitchen layout');
    const second = await notify(userId, 'review_requested', 'Bathroom tiles');
    const held = (await channels.deliveries([first, second])).filter(
      (row) => row.channel === 'email',
    );
    expect(held.map((row) => row.status)).toEqual(['digest', 'digest']);
    expect(await channels.queuedEvents([first, second])).toEqual([]);

    const senders = { sms: new ScriptedSmsSender(), email: new ScriptedEmailSender() };
    const runDigest = (taskQueue: string) =>
      env.client.workflow.execute(emailDigestWorkflow, {
        taskQueue,
        workflowId: uniqueWorkflowId('digest'),
      });
    const outcome = await run(senders, runDigest);
    expect(outcome.sent).toBeGreaterThanOrEqual(1);
    const mine = senders.email.sent.filter((email) => email.to === address);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.subject).toMatch(/^Your Lintel digest for .+: 2 updates$/);
    const [digest] = await channels.digests(userId);
    expect(digest).toMatchObject({ status: 'sent', itemCount: 2, attempts: 1 });
    const delivered = (await channels.deliveries([first, second])).filter(
      (row) => row.channel === 'email',
    );
    for (const row of delivered) {
      expect(row).toMatchObject({ status: 'sent', providerMessageId: `digest:${digest?.id}` });
    }

    // Nothing is held any more: a second run sends this person nothing.
    const again = { sms: new ScriptedSmsSender(), email: new ScriptedEmailSender() };
    await run(again, runDigest);
    expect(again.email.sent.filter((email) => email.to === address)).toEqual([]);
  });
});
