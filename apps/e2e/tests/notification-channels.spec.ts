import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/accessibility';
import { PEOPLE, sessionFile } from '../support/people';
import { StudioApi } from '../support/studio-api';

test.describe('notification channels in account settings', () => {
  test.use({ storageState: sessionFile('teamLead') });

  test('offers SMS for urgent alerts only, explains a missing email address', async ({
    page,
  }, testInfo) => {
    await page.goto('/account');
    const matrix = page.getByRole('table', { name: 'How each kind of notification reaches you' });
    await expect(matrix.getByRole('columnheader', { name: /SMS/ })).toBeVisible();
    await expect(matrix.getByRole('columnheader', { name: /Email/ })).toBeVisible();
    await expect(matrix.getByRole('checkbox', { name: 'A task is given to you: SMS' })).toHaveCount(
      0,
    );
    await expect(
      matrix.getByRole('checkbox', { name: 'Someone is unexpectedly away: SMS' }),
    ).toBeVisible();
    await expect(page.getByText('There’s no email address on your profile yet.')).toBeVisible();
    // No Firebase web config in this build: the browser push card hides itself.
    await expect(page.getByText('Notifications in this browser')).toHaveCount(0);
    await expectAccessible(page, testInfo, 'account notifications');
  });

  test('serves the web push worker publicly, uncached and locked down', async ({ request }) => {
    const response = await request.get('/firebase-messaging-sw.js', { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/javascript');
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(response.headers()['content-security-policy']).toContain("script-src 'self'");
  });
});

test.describe('email and the daily digest', () => {
  test.use({ storageState: sessionFile('designer') });

  test.beforeAll(async () => {
    // An administrator adds the designer's email address (people can't edit their own yet).
    const owner = await StudioApi.as('owner');
    const designerId = await owner.personId(PEOPLE.designer.fullName);
    const person = await owner.get<{ version: number }>(`/people/${designerId}`);
    await owner.patch(`/people/${designerId}`, {
      email: 'ananya.joshi@aranya.example',
      version: person.version,
    });
    await owner.dispose();
  });

  test('chooses email for new tasks, collected into one digest a day', async ({ page }) => {
    await page.goto('/account');
    const matrix = page.getByRole('table', { name: 'How each kind of notification reaches you' });
    const newTasks = matrix.getByRole('checkbox', { name: 'A task is given to you: email' });
    const digest = page
      .getByRole('region', { name: 'Email', exact: true })
      .getByRole('radio', { name: /^One digest at \d\d:\d\d$/ });
    await newTasks.click();
    await digest.click();
    await page.getByRole('button', { name: 'Save notification settings' }).click();
    await expect(page.getByText('Notification settings saved', { exact: true })).toBeVisible();

    await page.reload();
    await expect(newTasks).toBeChecked();
    await expect(digest).toBeChecked();
  });
});
