import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

let testApp: TestApp;
let token: string;
let userId: string;

beforeAll(async () => {
  testApp = await createTestApp();
  token = await signInAs(testApp, PEOPLE.teamLead);
  const me = await testApp.http.get('/v1/auth/me').set('authorization', `Bearer ${token}`);
  userId = me.body.id as string;
});

afterAll(async () => {
  await testApp.database.pool.query(
    'UPDATE users SET email_digest_enabled = false, email = NULL WHERE id = $1',
    [userId],
  );
  await testApp.database.pool.query('DELETE FROM notification_preferences WHERE user_id = $1', [
    userId,
  ]);
  await testApp.database.pool.query("DELETE FROM device_tokens WHERE token LIKE 'web-fid-%'");
  await testApp.close();
});

const auth = () => ({ authorization: `Bearer ${token}` });

describe('notification channel preferences', () => {
  it('reports the digest choice and which channels the studio has switched on', async () => {
    await testApp.database.pool.query('UPDATE users SET email = $1 WHERE id = $2', [
      'tara.lead@studio.example',
      userId,
    ]);
    const response = await testApp.http.get('/v1/notifications/preferences').set(auth());
    expect(response.status).toBe(200);
    expect(response.body.emailDigest).toBe('off');
    expect(response.body.delivery).toEqual({
      sms: false,
      email: false,
      hasEmailAddress: true,
      emailDigestTime: '18:00',
    });
    expect(JSON.stringify(response.body)).not.toContain('tara.lead@studio.example');
    const email = response.body.channels.find(
      (row: { kind: string; channel: string }) =>
        row.kind === 'task_assigned' && row.channel === 'email',
    );
    expect(email).toEqual({ kind: 'task_assigned', channel: 'email', enabled: false });
  });

  it('saves email per kind and the daily digest, and keeps the digest for older apps', async () => {
    const saved = await testApp.http
      .put('/v1/notifications/preferences')
      .set(auth())
      .send({
        quietHours: null,
        channels: [{ kind: 'task_assigned', channel: 'email', enabled: true }],
        emailDigest: 'daily',
      });
    expect(saved.status).toBe(200);
    expect(saved.body.emailDigest).toBe('daily');
    expect(saved.body.channels).toContainEqual({
      kind: 'task_assigned',
      channel: 'email',
      enabled: true,
    });
    // A client that does not know about digests leaves the choice alone.
    const older = await testApp.http
      .put('/v1/notifications/preferences')
      .set(auth())
      .send({ quietHours: null, channels: [] });
    expect(older.status).toBe(200);
    expect(older.body.emailDigest).toBe('daily');
    const audit = await testApp.database.pool.query(
      `SELECT after FROM audit_log WHERE actor_user_id = $1
         AND action = 'notifications.preferences_updated' ORDER BY created_at DESC LIMIT 2`,
      [userId],
    );
    expect(
      audit.rows.map((row: { after: { emailDigest?: string } }) => row.after.emailDigest),
    ).toEqual([undefined, 'daily']);
  });

  it('registers and unregisters a web push installation', async () => {
    const registered = await testApp.http
      .post('/v1/devices')
      .set(auth())
      .send({
        platform: 'web',
        tokenType: 'fcm_fid',
        token: `web-fid-${userId.slice(0, 18)}`,
        appVersion: null,
      });
    expect(registered.status).toBe(200);
    expect(registered.body.platform).toBe('web');
    const stored = await testApp.database.pool.query(
      'SELECT token_type FROM device_tokens WHERE id = $1',
      [registered.body.id],
    );
    expect(stored.rows[0]?.token_type).toBe('fcm_fid');
    await testApp.http.delete(`/v1/devices/${registered.body.id}`).set(auth()).expect(204);
    const unknownType = await testApp.http
      .post('/v1/devices')
      .set(auth())
      .send({ platform: 'web', tokenType: 'webpush', token: 'x'.repeat(30), appVersion: null });
    expect(unknownType.status).toBe(400);
  });
});
