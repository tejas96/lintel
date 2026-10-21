import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

let testApp: TestApp;
let designer: ReturnType<typeof client>;
let original: { fullName: string; email: string | null; designation: string | null };

beforeAll(async () => {
  testApp = await createTestApp();
  designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
  const profile = await designer.get('/v1/me/profile').expect(200);
  original = {
    fullName: profile.body.fullName,
    email: profile.body.email,
    designation: profile.body.designation,
  };
});

afterAll(async () => {
  const profile = await designer.get('/v1/me/profile').expect(200);
  await designer.patch('/v1/me/profile', { ...original, version: profile.body.version });
  await testApp.close();
});

describe('self-profile editing', () => {
  it('lets people change their own name, email and designation, audited', async () => {
    const before = await designer.get('/v1/me/profile').expect(200);
    expect(before.body.maskedPhone).toMatch(/•/);
    const updated = await designer
      .patch('/v1/me/profile', {
        designation: 'Senior interior designer',
        email: 'ananya.joshi@studio.test',
        version: before.body.version,
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      designation: 'Senior interior designer',
      email: 'ananya.joshi@studio.test',
      role: 'employee',
      version: before.body.version + 1,
    });
    const me = await designer.get('/v1/auth/me').expect(200);
    expect(me.body.designation).toBe('Senior interior designer');
    const userId = await userIdOf(testApp, PEOPLE.employee);
    const audit = await testApp.database.pool.query(
      "SELECT count(*)::int AS n FROM audit_log WHERE action = 'people.profile_updated' AND entity_id = $1",
      [userId],
    );
    expect(audit.rows[0]?.n).toBeGreaterThanOrEqual(1);
  });

  it('refuses role, phone and status changes outright', async () => {
    const before = await designer.get('/v1/me/profile').expect(200);
    const attempts = [
      { role: 'owner' },
      { countryCallingCode: '91', nationalNumber: '9111122222' },
      { phoneE164: '+919111122222' },
      { status: 'active' },
      { teamId: null },
    ];
    for (const attempt of attempts) {
      const response = await designer.patch('/v1/me/profile', {
        ...attempt,
        version: before.body.version,
      });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_FAILED');
    }
    const row = await testApp.database.pool.query(
      'SELECT role, phone_e164 FROM users WHERE id = $1',
      [before.body.id],
    );
    expect(row.rows[0]).toEqual({ role: 'employee', phone_e164: `+91${PEOPLE.employee}` });
    const after = await designer.get('/v1/me/profile').expect(200);
    expect(after.body.version).toBe(before.body.version);
  });

  it('refuses a stale version', async () => {
    const before = await designer.get('/v1/me/profile').expect(200);
    const response = await designer.patch('/v1/me/profile', {
      designation: 'Someone else saved first',
      version: before.body.version - 1,
    });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('STALE_VERSION');
  });
});
