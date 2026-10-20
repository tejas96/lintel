import { describe, expect, it } from 'vitest';
import { createFakeWorld } from '../testing/fake-world';
import { OWNER, pushFacts } from '../testing/fixtures';
import { createPushDeliveryActivities } from './push-delivery.activities';
import { formatSentDevices, parseSentDevices } from './push-progress';

const phone = { id: 'device-phone', token: 'token-phone', tokenType: 'fcm' as const };
const tablet = { id: 'device-tablet', token: 'token-tablet', tokenType: 'fcm' as const };

function world(status: Parameters<typeof pushFacts>[0], options?: Parameters<typeof pushFacts>[1]) {
  const fake = createFakeWorld();
  const store = fake.stores.background.pushDeliveries;
  store.facts.set('notification-1', pushFacts(status, options));
  store.devices.set(OWNER, [phone, tablet]);
  return { ...fake, store, activities: createPushDeliveryActivities(fake.deps) };
}

describe('push delivery planning', () => {
  it('waits for quiet hours to end on deferred deliveries', async () => {
    const fake = world('deferred', { notBefore: new Date('2026-11-09T06:00:30.000Z') });
    expect(await fake.activities.planPushDelivery('notification-1')).toEqual({
      state: 'deferred',
      delayMs: 30_000,
    });
    expect(await world('pending').activities.planPushDelivery('notification-1')).toEqual({
      state: 'ready',
      delayMs: 0,
    });
    expect((await world('sent').activities.planPushDelivery('notification-1')).state).toBe(
      'finished',
    );
  });
});

describe('push delivery', () => {
  it('sends to every active device with the push preview and the in-app link', async () => {
    const fake = world('pending');
    expect(await fake.activities.deliverPush('notification-1')).toBe('sent');
    expect(fake.push.sent.map((message) => message.token)).toEqual(['token-phone', 'token-tablet']);
    expect(fake.push.sent[0]).toMatchObject({
      title: 'Overdue: Working drawings',
      linkPath: '/tasks/task-1',
      collapseKey: 'notification:notification-1',
    });
    expect(fake.store.delivery('notification-1')).toMatchObject({
      status: 'sent',
      attempts: 1,
      providerMessageId: 'device-phone=msg-token-phone;device-tablet=msg-token-tablet',
    });
  });

  it('is idempotent: a finished delivery is never sent again', async () => {
    const fake = world('sent');
    expect(await fake.activities.deliverPush('notification-1')).toBe('already_finished');
    expect(fake.push.sent).toEqual([]);
  });

  it('revokes devices whose token is invalid and still delivers to the others', async () => {
    const fake = world('pending');
    fake.push.script.set('token-phone', [
      { outcome: 'invalid_token', reason: 'messaging/registration-token-not-registered' },
    ]);
    expect(await fake.activities.deliverPush('notification-1')).toBe('sent');
    expect(fake.store.revoked).toEqual([
      {
        deviceId: 'device-phone',
        reason: expect.stringContaining('registration-token-not-registered'),
      },
    ]);
    expect(fake.store.delivery('notification-1')?.providerMessageId).toBe(
      'device-tablet=msg-token-tablet',
    );
  });

  it('throws on retryable failures and skips already-reached devices on the retry', async () => {
    const fake = world('pending');
    fake.push.script.set('token-tablet', [
      { outcome: 'retryable_failure', reason: 'messaging/server-unavailable' },
    ]);
    await expect(fake.activities.deliverPush('notification-1')).rejects.toThrow(/retried/);
    expect(fake.store.delivery('notification-1')).toMatchObject({
      status: 'pending',
      attempts: 1,
      providerMessageId: 'device-phone=msg-token-phone',
    });
    expect(await fake.activities.deliverPush('notification-1')).toBe('sent');
    expect(fake.push.sent.map((message) => message.token)).toEqual([
      'token-phone',
      'token-tablet',
      'token-tablet',
    ]);
    expect(fake.store.delivery('notification-1')?.attempts).toBe(2);
  });

  it('marks development deliveries skipped with the provider reason, never sent', async () => {
    const fake = world('pending');
    const reason = 'Push delivery is not configured in this environment.';
    for (const token of ['token-phone', 'token-tablet']) {
      fake.push.script.set(token, [{ outcome: 'not_configured', reason }]);
    }
    expect(await fake.activities.deliverPush('notification-1')).toBe('skipped');
    expect(fake.store.delivery('notification-1')?.status).toBe('skipped');
    expect(fake.store.lastError.get('delivery-1')).toBe(reason);
  });

  it('records permanent failures and skips recipients without devices', async () => {
    const fake = world('pending');
    fake.push.script.set('token-phone', [{ outcome: 'permanent_failure', reason: 'bad payload' }]);
    fake.push.script.set('token-tablet', [{ outcome: 'permanent_failure', reason: 'bad payload' }]);
    expect(await fake.activities.deliverPush('notification-1')).toBe('failed');
    expect(fake.store.lastError.get('delivery-1')).toBe('permanent_failure: bad payload');

    const lonely = world('pending');
    lonely.store.devices.set(OWNER, []);
    expect(await lonely.activities.deliverPush('notification-1')).toBe('skipped');
    expect(lonely.store.lastError.get('delivery-1')).toBe('No active device.');
  });

  it('records the final failure after retries are exhausted', async () => {
    const fake = world('pending', { attempts: 6 });
    expect(await fake.activities.recordPushFailure('notification-1', 'Gave up')).toBe('failed');
    expect(fake.store.delivery('notification-1')).toMatchObject({ status: 'failed', attempts: 6 });
  });
});

describe('push progress encoding', () => {
  it('round-trips device progress', () => {
    const sent = new Map([
      ['d1', 'projects/x/messages/0:1%a'],
      ['d2', 'm2'],
    ]);
    expect(parseSentDevices(formatSentDevices(sent))).toEqual(sent);
    expect(parseSentDevices(null).size).toBe(0);
    expect(formatSentDevices(new Map())).toBeNull();
  });
});
