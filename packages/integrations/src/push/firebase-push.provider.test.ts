import type { PushMessage } from '@lintel/application';
import type { Message } from 'firebase-admin/messaging';
import { describe, expect, it } from 'vitest';
import { FirebasePushProvider, firebaseMessageFor, webClickLink } from './firebase-push.provider';

const config = {
  projectId: 'lintel-test',
  clientEmail: 'push@lintel-test.iam.gserviceaccount.com',
  privateKey: 'unused-with-a-fake-client',
  webBaseUrl: 'https://studio.example.com',
};

const push: PushMessage = {
  token: 'fid-abcdefghijklmnopqrstu',
  tokenType: 'fcm_fid',
  title: 'Work waits for your review',
  body: 'Kitchen elevations v2',
  linkPath: '/deliverables/d1',
  collapseKey: 'notification:n1',
};

function fakeClient(outcome: () => Promise<string>) {
  const sent: Message[] = [];
  return {
    sent,
    client: {
      async send(message: Message) {
        sent.push(message);
        return outcome();
      },
    },
  };
}

describe('Firebase push provider', () => {
  it('targets web installations by FID with a tag and an https click link', () => {
    const message = firebaseMessageFor(push, config.webBaseUrl);
    expect(message).toMatchObject({
      fid: 'fid-abcdefghijklmnopqrstu',
      notification: { title: push.title, body: push.body },
      data: { linkPath: '/deliverables/d1' },
      webpush: {
        notification: { tag: 'notification:n1' },
        fcmOptions: { link: 'https://studio.example.com/deliverables/d1' },
      },
    });
    expect('token' in message).toBe(false);
  });

  it('keeps Android registration tokens on `token`', () => {
    const message = firebaseMessageFor({ ...push, tokenType: 'fcm', token: 'android-token' });
    expect(message).toMatchObject({ token: 'android-token', android: { priority: 'high' } });
    expect('fid' in message).toBe(false);
  });

  it('only adds a click link for https addresses (FCM rejects others)', () => {
    expect(webClickLink('http://localhost:3100', '/today')).toBeNull();
    expect(webClickLink(undefined, '/today')).toBeNull();
    expect(webClickLink('https://studio.example.com', '//evil.example')).toBe(
      'https://studio.example.com/today',
    );
  });

  it('sends through the messaging client and maps dead installations', async () => {
    const ok = fakeClient(async () => 'projects/lintel-test/messages/1');
    const provider = new FirebasePushProvider(config, ok.client);
    expect(await provider.send(push)).toEqual({
      outcome: 'sent',
      providerMessageId: 'projects/lintel-test/messages/1',
    });
    const dead = fakeClient(async () => {
      throw Object.assign(new Error('gone'), { code: 'messaging/installation-id-not-registered' });
    });
    expect(await new FirebasePushProvider(config, dead.client).send(push)).toEqual({
      outcome: 'invalid_token',
      reason: 'messaging/installation-id-not-registered',
    });
    await provider.close();
  });

  it('never sends raw APNs tokens', async () => {
    const fake = fakeClient(async () => 'unused');
    const result = await new FirebasePushProvider(config, fake.client).send({
      ...push,
      tokenType: 'apns',
    });
    expect(result.outcome).toBe('not_configured');
    expect(fake.sent).toHaveLength(0);
  });
});
