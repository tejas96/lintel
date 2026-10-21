import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/accessibility';
import { sessionFile } from '../support/people';

test.use({ storageState: sessionFile('owner') });

test.describe('owner command center', () => {
  test('shows business-wide health computed from live records', async ({ page }, testInfo) => {
    await page.goto('/command-center');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Banyan Court Villa').first()).toBeVisible();
    await expectAccessible(page, testInfo, 'command center');
  });

  test('is not offered to a designer', async ({ browser }) => {
    const context = await browser.newContext({ storageState: sessionFile('designer') });
    const page = await context.newPage();
    await page.goto('/today');
    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'Command center' }),
    ).toHaveCount(0);
    await context.close();
  });
});
