import type { MessageChannel, MessageDeliveryFacts } from '@lintel/application';
import { ApplicationFailure } from '@temporalio/common';
import { describe, expect, it } from 'vitest';
import { createFakeWorld } from '../testing/fake-world';
import { OWNER } from '../testing/fixtures';
import { createMessageDeliveryActivities } from './message-delivery.activities';

type Status = NonNullable<MessageDeliveryFacts['delivery']>['status'];

function facts(
  status: Status,
  overrides: Partial<MessageDeliveryFacts> = {},
): MessageDeliveryFacts {
  return {
    notificationId: 'notification-1',
    kind: 'absence_reassessment',
    title: 'Ananya is unexpectedly away',
    body: 'Three of her tasks are due this week.',
    linkPath: '/leave/leave-1',
    recipient: {
      userId: OWNER,
      fullName: 'Nisha Varma',
      active: true,
      phoneE164: '+919000000003',
      email: 'nisha@studio.example',
    },
    delivery: { id: 'delivery-1', status, attempts: 0 },
    ...overrides,
  };
}

function world(channel: MessageChannel, status: Status = 'pending', overrides = {}) {
  const fake = createFakeWorld();
  const store = fake.stores.background.messageDeliveries;
  store.add(channel, facts(status, overrides));
  return { ...fake, store, activities: createMessageDeliveryActivities(fake.deps, fake.channels) };
}

describe('SMS delivery', () => {
  it('sends only a generic link, never the notification text, and records the attempt', async () => {
    const fake = world('sms');
    expect(await fake.activities.deliverMessage('notification-1', 'sms')).toBe('sent');
    expect(fake.sms.sent).toEqual([
      {
        phoneE164: '+919000000003',
        link: 'https://studio.example.com/leave/leave-1',
        reference: 'delivery-1',
      },
    ]);
    expect(JSON.stringify(fake.sms.sent)).not.toContain('Ananya');
    expect(fake.store.delivery('notification-1', 'sms')).toMatchObject({
      status: 'sent',
      attempts: 1,
    });
    expect(fake.store.attempts).toMatchObject([
      {
        attempt: 1,
        channel: 'sms',
        provider: 'scripted-sms: tpl-1 (DLT 1107000000000000001)',
        finish: { outcome: 'sent', providerMessageId: 'sms-1', deliveryStatus: 'sent' },
      },
    ]);
  });

  it('retries provider outages with a new attempt row each time', async () => {
    const fake = world('sms');
    fake.sms.script.push({ outcome: 'retryable_failure', reason: 'MSG91 could not be reached.' });
    await expect(fake.activities.deliverMessage('notification-1', 'sms')).rejects.toBeInstanceOf(
      ApplicationFailure,
    );
    expect(fake.store.delivery('notification-1', 'sms')).toMatchObject({
      status: 'pending',
      attempts: 1,
    });
    expect(await fake.activities.deliverMessage('notification-1', 'sms')).toBe('sent');
    expect(fake.store.attempts.map((row) => `${row.attempt}:${row.finish?.outcome}`)).toEqual([
      '1:retryable_failure',
      '2:sent',
    ]);
  });

  it('records rejected and development sends honestly', async () => {
    const rejected = world('sms');
    rejected.sms.script.push({
      outcome: 'permanent_failure',
      reason: 'MSG91 rejected the SMS template.',
    });
    expect(await rejected.activities.deliverMessage('notification-1', 'sms')).toBe('failed');
    expect(rejected.store.lastError.get('delivery-1')).toBe('MSG91 rejected the SMS template.');
    const development = world('sms');
    development.sms.script.push({ outcome: 'not_configured', reason: 'Development SMS sender.' });
    expect(await development.activities.deliverMessage('notification-1', 'sms')).toBe('skipped');
  });

  it('is idempotent and skips people who left', async () => {
    const finished = world('sms', 'sent');
    expect(await finished.activities.deliverMessage('notification-1', 'sms')).toBe(
      'already_finished',
    );
    expect(await finished.activities.deliverMessage('notification-9', 'sms')).toBe('missing');
    const inactive = world('sms', 'pending', {
      recipient: { ...facts('pending').recipient, active: false },
    });
    expect(await inactive.activities.deliverMessage('notification-1', 'sms')).toBe('skipped');
    expect(inactive.sms.sent).toEqual([]);
    expect(inactive.store.attempts[0]?.finish?.outcome).toBe('recipient_unavailable');
  });

  it('gives up after the last retry', async () => {
    const fake = world('sms');
    expect(await fake.activities.recordMessageFailure('notification-1', 'sms', 'Gave up')).toBe(
      'failed',
    );
    expect(await fake.activities.recordMessageFailure('notification-1', 'sms', 'Again')).toBe(
      'already_finished',
    );
  });
});

describe('email delivery', () => {
  it('sends the branded email with a stable Message-ID and a link to the record', async () => {
    const fake = world('email');
    expect(await fake.activities.deliverMessage('notification-1', 'email')).toBe('sent');
    const email = fake.email.sent[0];
    expect(email).toMatchObject({
      to: 'nisha@studio.example',
      subject: 'Ananya is unexpectedly away',
      messageId: '<notification.notification-1@studio.example.com>',
      reference: 'delivery-1',
    });
    expect(email?.text).toContain('https://studio.example.com/leave/leave-1');
    expect(email?.text).toContain('Test studio · Lintel');
    expect(email?.html).toContain('href="https://studio.example.com/leave/leave-1"');
  });

  it('keeps sensitive kinds generic', async () => {
    const fake = world('email', 'pending', { kind: 'reward_updated', title: 'Reward: ₹5,000' });
    await fake.activities.deliverMessage('notification-1', 'email');
    expect(fake.email.sent[0]?.subject).toBe('Lintel');
    expect(fake.email.sent[0]?.text).not.toContain('₹');
    expect(fake.email.sent[0]?.html).not.toContain('₹');
  });

  it('skips people without an address', async () => {
    const fake = world('email', 'pending', {
      recipient: { ...facts('pending').recipient, email: null },
    });
    expect(await fake.activities.deliverMessage('notification-1', 'email')).toBe('skipped');
    expect(fake.email.sent).toEqual([]);
    expect(fake.store.lastError.get('delivery-1')).toBe('No email address on file.');
  });
});
