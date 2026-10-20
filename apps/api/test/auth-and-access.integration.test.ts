import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

let testApp: TestApp;

/** Test clean-up: audit rows reference people, so remove them first. */
async function removePerson(phoneE164: string): Promise<void> {
  const people = await testApp.database.pool.query('SELECT id FROM users WHERE phone_e164 = $1', [
    phoneE164,
  ]);
  for (const row of people.rows as { id: string }[]) {
    await testApp.database.pool.query('DELETE FROM audit_log WHERE actor_user_id = $1', [row.id]);
    await testApp.database.pool.query('DELETE FROM users WHERE id = $1', [row.id]);
  }
}

beforeAll(async () => {
  testApp = await createTestApp();
});

afterAll(async () => {
  await testApp.close();
});

function cookiesOf(setCookie: string | string[] | undefined): Record<string, string> {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return Object.fromEntries(
    list
      .map((cookie) => cookie.split(';')[0]?.split('=') ?? [])
      .filter((pair) => pair.length === 2),
  );
}

describe('web sign-in with cookie session and CSRF', () => {
  it('sets an HttpOnly session cookie and enforces the CSRF header on unsafe requests', async () => {
    const { http, database } = testApp;
    await database.pool.query("DELETE FROM otp_challenges WHERE phone_e164 = '+919000000002'");
    await http
      .post('/v1/auth/otp/request')
      .send({ countryCallingCode: '91', nationalNumber: PEOPLE.administrator });
    const verify = await http
      .post('/v1/auth/otp/verify')
      .send({
        countryCallingCode: '91',
        nationalNumber: PEOPLE.administrator,
        code: '123456',
        client: 'web',
      })
      .expect(200);
    expect(verify.body.sessionToken).toBeNull();
    const rawCookies = verify.headers['set-cookie'];
    const serialized = (Array.isArray(rawCookies) ? rawCookies : [String(rawCookies)]).join('\n');
    expect(serialized).toMatch(/lintel_session=[^;]+;.*HttpOnly/i);
    const cookies = cookiesOf(rawCookies);
    const cookieHeader = `lintel_session=${cookies.lintel_session}; lintel_csrf=${cookies.lintel_csrf}`;

    await http.get('/v1/auth/me').set('cookie', cookieHeader).expect(200);
    const forged = await http
      .post('/v1/teams')
      .set('cookie', cookieHeader)
      .send({ name: 'No CSRF', description: null });
    expect(forged.status).toBe(403);
    const signOut = await http
      .post('/v1/auth/sign-out')
      .set('cookie', cookieHeader)
      .set('x-lintel-csrf', cookies.lintel_csrf ?? '')
      .send({});
    expect(signOut.status).toBe(204);
    await http.get('/v1/auth/me').set('cookie', cookieHeader).expect(401);
  });
});

describe('sign-in abuse controls', () => {
  it('answers unknown numbers like known ones and enforces the resend cooldown', async () => {
    const { http } = testApp;
    const unknown = await http
      .post('/v1/auth/otp/request')
      .send({ countryCallingCode: '91', nationalNumber: '9888877777' });
    expect(unknown.status).toBe(200);
    const again = await http
      .post('/v1/auth/otp/request')
      .send({ countryCallingCode: '91', nationalNumber: '9888877777' });
    expect(again.status).toBe(429);
    expect(again.body.code).toBe('RATE_LIMITED');
    expect(Number(again.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('rejects a wrong code with a generic message', async () => {
    const { http, database } = testApp;
    await database.pool.query("DELETE FROM otp_challenges WHERE phone_e164 = '+919000000008'");
    await http
      .post('/v1/auth/otp/request')
      .send({ countryCallingCode: '91', nationalNumber: '9000000008' });
    const response = await http.post('/v1/auth/otp/verify').send({
      countryCallingCode: '91',
      nationalNumber: '9000000008',
      code: '000000',
      client: 'mobile',
    });
    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/incorrect or has expired/);
  });
});

describe('authorisation boundaries', () => {
  it('requires a session for every non-public route', async () => {
    await testApp.http.get('/v1/people').expect(401);
    await testApp.http.get('/v1/health').expect(200);
  });

  it('stops an employee from administering people but lets an administrator', async () => {
    const employee = await signInAs(testApp, PEOPLE.employee);
    const body = {
      fullName: 'Integration Person',
      countryCallingCode: '91',
      nationalNumber: '9111100001',
      email: null,
      designation: null,
      role: 'employee',
      teamId: null,
      reportsToUserId: null,
      capacityPercent: 100,
    };
    const denied = await testApp.http
      .post('/v1/people')
      .set('authorization', `Bearer ${employee}`)
      .send(body);
    expect(denied.status).toBe(403);
    const admin = await signInAs(testApp, PEOPLE.administrator);
    await removePerson('+919111100001');
    const created = await testApp.http
      .post('/v1/people')
      .set('authorization', `Bearer ${admin}`)
      .send(body);
    expect(created.status).toBe(201);
    expect(created.body.maskedPhone).toBe('+91 •••••• 0001');
    await removePerson('+919111100001');
  });

  it('revokes every session when a person is deactivated', async () => {
    const { http } = testApp;
    const admin = await signInAs(testApp, PEOPLE.administrator);
    await removePerson('+919111100002');
    const created = await http
      .post('/v1/people')
      .set('authorization', `Bearer ${admin}`)
      .send({
        fullName: 'Leaving Person',
        countryCallingCode: '91',
        nationalNumber: '9111100002',
        email: null,
        designation: null,
        role: 'employee',
        teamId: null,
        reportsToUserId: null,
        capacityPercent: 100,
      })
      .expect(201);
    const target = await signInAs(testApp, '9111100002');
    await http.get('/v1/auth/me').set('authorization', `Bearer ${target}`).expect(200);
    await http
      .post(`/v1/people/${created.body.id}/deactivate`)
      .set('authorization', `Bearer ${admin}`)
      .send({ reason: 'Left the studio', version: created.body.version })
      .expect(200);
    await http.get('/v1/auth/me').set('authorization', `Bearer ${target}`).expect(401);
    await removePerson('+919111100002');
  });

  it('keeps AI disabled in Phase 1', async () => {
    const token = await signInAs(testApp, PEOPLE.owner);
    const status = await testApp.http
      .get('/v1/ai/status')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(status.body.enabled).toBe(false);
    const me = await testApp.http
      .get('/v1/auth/me')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.aiFeaturesEnabled).toBe(false);
  });
});
