import { expect, type Page, test } from '@playwright/test';
import { expectAccessible } from '../support/accessibility';
import { sessionFile } from '../support/people';

test.use({ storageState: sessionFile('projectManager') });

async function openProjectTab(page: Page, tab: string): Promise<void> {
  await page.goto('/projects');
  await page
    .getByRole('link', { name: /Saska Residence/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Saska Residence' })).toBeVisible();
  await page.getByRole('link', { name: tab, exact: true }).click();
}

test.describe('planning on the timeline', () => {
  test('a manager moves a bar with the keyboard and reviews the knock-on before saving', async ({
    page,
  }, testInfo) => {
    await openProjectTab(page, 'Timeline');
    await expect(page.getByText(/Drag a bar to move it/)).toBeVisible();
    const bar = page.locator('[data-gantt-key]').first();
    await bar.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    const review = page.getByRole('region', { name: /to|Moving/ }).filter({
      has: page.getByRole('button', { name: 'Put it back' }),
    });
    await expect(review).toBeVisible();
    await expect(review.getByText(/agreed end/)).toBeVisible();
    await expectAccessible(page, testInfo, 'timeline review');
    await review.getByRole('button', { name: 'Put it back' }).click();
    await expect(page.getByRole('button', { name: 'Put it back' })).toHaveCount(0);
  });

  test('the scope tab has no serious accessibility problems', async ({ page }, testInfo) => {
    await openProjectTab(page, 'Scope changes');
    await expect(page.getByRole('button', { name: 'Propose a change' })).toBeVisible();
    await expectAccessible(page, testInfo, 'scope changes');
  });
});
