import type { DigestRecipient, HeldDigestEmail } from '@lintel/application';
import type { NotificationKind } from '@lintel/domain';
import { ApplicationFailure } from '@temporalio/common';
import { describe, expect, it } from 'vitest';
import { createFakeWorld } from '../testing/fake-world';
import { MANAGER, OWNER } from '../testing/fixtures';
import { createEmailDigestActivities } from './email-digest.activities';

const recipient: DigestRecipient = {
  userId: OWNER,
  fullName: 'Ananya Joshi',
  active: true,
  email: 'ananya@studio.example',
};

function heldEmail(id: string, kind: NotificationKind, title: string): HeldDigestEmail {
  return {
    deliveryId: `delivery-${id}`,
    notificationId: `notification-${id}`,
    kind,
    title,
    body: `${title} — details`,
    linkPath: `/tasks/${id}`,
    createdAt: new Date('2026-11-09T05:00:00.000Z'),
  };
}

function world() {
  const fake = createFakeWorld('2026-11-09T12:30:00.000Z');
  const store = fake.stores.background.emailDigests;
  return { ...fake, store, activities: createEmailDigestActivities(fake.deps, fake.channels) };
}

describe('email digest', () => {
  it('plans today in the business timezone for everyone with held emails', async () => {
    const fake = world();
    fake.store.hold(recipient, [heldEmail('1', 'task_assigned', 'Kitchen layout')]);
    fake.store.hold({ ...recipient, userId: MANAGER }, []);
    expect(await fake.activities.planEmailDigests()).toEqual({
      digestDate: '2026-11-09',
      userIds: [OWNER],
    });
  });

  it('sends one grouped digest a day and marks every held email delivered', async () => {
    const fake = world();
    fake.store.hold(recipient, [
      heldEmail('1', 'task_assigned', 'Kitchen layout'),
      heldEmail('2', 'review_requested', 'Bathroom tiles v2'),
      heldEmail('3', 'task_overdue', 'Electrical plan'),
    ]);
    expect(await fake.activities.sendEmailDigest(OWNER, '2026-11-09')).toBe('sent');
    const email = fake.email.sent[0];
    expect(email?.subject).toBe('Your Lintel digest for Monday 9 November: 3 updates');
    expect(email?.messageId).toBe('<digest.digest-1@studio.example.com>');
    const text = email?.text ?? '';
    expect(text.indexOf('YOUR WORK')).toBeLessThan(text.indexOf('BLOCKERS AND REVIEWS'));
    expect(text.indexOf('Electrical plan')).toBeLessThan(text.indexOf('Kitchen layout'));
    expect(fake.store.held.get(OWNER)).toEqual([]);
    expect(fake.store.finished.get('delivery-2')).toEqual({ status: 'sent', reason: null });
    expect(fake.store.digests[0]).toMatchObject({ status: 'sent', itemCount: 3, attempts: 1 });
    // A re-run the same day finds nothing held and sends nothing.
    expect(await fake.activities.sendEmailDigest(OWNER, '2026-11-09')).toBe('empty');
    expect(fake.email.sent).toHaveLength(1);
  });

  it('never sends an empty digest', async () => {
    const fake = world();
    fake.store.hold(recipient, []);
    expect(await fake.activities.sendEmailDigest(OWNER, '2026-11-09')).toBe('empty');
    expect(fake.email.sent).toEqual([]);
    expect(fake.store.digests).toEqual([]);
  });

  it('skips held emails of people without an address', async () => {
    const fake = world();
    fake.store.hold({ ...recipient, email: null }, [heldEmail('1', 'task_assigned', 'Layout')]);
    expect(await fake.activities.sendEmailDigest(OWNER, '2026-11-09')).toBe('skipped');
    expect(fake.store.finished.get('delivery-1')).toEqual({
      status: 'skipped',
      reason: 'No email address on file.',
    });
  });

  it('retries a mail server outage on the same digest, then sends it', async () => {
    const fake = world();
    fake.store.hold(recipient, [heldEmail('1', 'task_assigned', 'Layout')]);
    fake.email.script.push({
      outcome: 'retryable_failure',
      reason: 'The mail server could not be reached.',
    });
    await expect(fake.activities.sendEmailDigest(OWNER, '2026-11-09')).rejects.toBeInstanceOf(
      ApplicationFailure,
    );
    expect(fake.store.digests[0]).toMatchObject({ status: 'pending', attempts: 1 });
    expect(await fake.activities.sendEmailDigest(OWNER, '2026-11-09')).toBe('sent');
    expect(fake.store.attempts.map((row) => `${row.attempt}:${row.outcome}`)).toEqual([
      '1:retryable_failure',
      '2:sent',
    ]);
    expect(fake.email.sent.map((email) => email.messageId)).toEqual([
      '<digest.digest-1@studio.example.com>',
      '<digest.digest-1@studio.example.com>',
    ]);
  });

  it('keeps the emails for tomorrow when the digest gives up', async () => {
    const fake = world();
    fake.store.hold(recipient, [heldEmail('1', 'task_assigned', 'Layout')]);
    fake.email.script.push({ outcome: 'retryable_failure', reason: 'Timeout' });
    await expect(fake.activities.sendEmailDigest(OWNER, '2026-11-09')).rejects.toThrow();
    await fake.activities.recordDigestFailure(OWNER, '2026-11-09', 'Gave up after retries');
    expect(fake.store.digests[0]).toMatchObject({ status: 'failed' });
    expect(fake.store.held.get(OWNER)).toHaveLength(1);
    expect(await fake.activities.sendEmailDigest(OWNER, '2026-11-10')).toBe('sent');
  });

  it('records a development sender as skipped, never as sent', async () => {
    const fake = world();
    fake.store.hold(recipient, [heldEmail('1', 'task_assigned', 'Layout')]);
    fake.email.script.push({ outcome: 'not_configured', reason: 'Development email sender.' });
    expect(await fake.activities.sendEmailDigest(OWNER, '2026-11-09')).toBe('skipped');
    expect(fake.store.finished.get('delivery-1')?.status).toBe('skipped');
  });
});
