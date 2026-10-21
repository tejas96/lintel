import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/accessibility';
import { sessionFile } from '../support/people';
import { StudioApi } from '../support/studio-api';

test.use({ storageState: sessionFile('owner') });

interface LeavePage {
  readonly items: readonly { readonly id: string; readonly status: string }[];
}

test.describe('risk intelligence', () => {
  test('the command center explains the score and names the next action', async ({
    page,
  }, testInfo) => {
    await page.goto('/command-center');
    await expect(page.getByRole('heading', { name: 'Business health' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'What could slip, and what to do' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'How it’s scored' }).click();
    await expect(page.getByText('100 minus five penalties')).toBeVisible();
    await expectAccessible(page, testInfo, 'health score formula');
  });

  test('a leave request suggests who could cover each affected task', async ({
    page,
  }, testInfo) => {
    const api = await StudioApi.as('owner');
    const list = await api.get<LeavePage>(
      '/leave/requests?scope=all&status=approved&page=1&pageSize=100',
    );
    let covered: string | null = null;
    for (const request of list.items.filter((item) => item.status === 'approved')) {
      const cover = await api.get<{ tasks: readonly unknown[] }>(
        `/leave/requests/${request.id}/cover-suggestions`,
      );
      if (cover.tasks.length > 0) {
        covered = request.id;
        break;
      }
    }
    test.skip(covered === null, 'The demo data has no approved leave with affected work.');
    await page.goto(`/leave/${covered}`);
    await expect(page.getByRole('heading', { name: 'Who could cover' })).toBeVisible();
    await expectAccessible(page, testInfo, 'cover suggestions');
  });
});
