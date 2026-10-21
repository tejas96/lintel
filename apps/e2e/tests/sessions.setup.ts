import { expect, test as setup } from '@playwright/test';
import { E2E } from '../support/environment';
import { PEOPLE, SESSION_ROLES, sessionFile } from '../support/people';

/**
 * Signs each role in once through the public sign-in API (same cookies the
 * web app receives) and saves the browser state, so journeys start signed in.
 * The sign-in screen itself is covered by sign-in.spec.ts.
 */
for (const role of SESSION_ROLES) {
  setup(`sign in as ${role}`, async ({ request }) => {
    const person = PEOPLE[role];
    const body = { countryCallingCode: '91', nationalNumber: person.nationalNumber };
    const requested = await request.post('/api/v1/auth/otp/request', { data: body });
    expect(requested.status()).toBe(200);
    const verified = await request.post('/api/v1/auth/otp/verify', {
      data: { ...body, code: E2E.otpCode, client: 'web' },
    });
    expect(verified.status()).toBe(200);
    const me = await request.get('/api/v1/auth/me');
    expect((await me.json()).fullName).toBe(person.fullName);
    await request.storageState({ path: sessionFile(role) });
  });
}
