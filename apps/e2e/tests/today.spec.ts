import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/accessibility';
import { sessionFile } from '../support/people';

test.use({ storageState: sessionFile('designer') });

test.describe('Today', () => {
  test('shows the next priority with its reasons and the rest of the day in order', async ({
    page,
  }, testInfo) => {
    await page.goto('/today');
    await expect(
      page.getByRole('heading', { name: /Good (morning|afternoon|evening), Ananya/ }),
    ).toBeVisible();
    await expect(page.getByText('Next priority')).toBeVisible();
    await expect(page.getByText('Why it comes first')).toBeVisible();
    await expect(page.getByText('Today’s load')).toBeVisible();
    await expect(page.getByText('How this list is ordered')).toBeVisible();
    await expectAccessible(page, testInfo, 'Today');
  });
});
