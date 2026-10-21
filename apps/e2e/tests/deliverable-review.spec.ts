import { type Browser, expect, type Page, test } from '@playwright/test';
import { expectAccessible } from '../support/accessibility';
import { PEOPLE, type SessionRole, sessionFile } from '../support/people';
import { StudioApi } from '../support/studio-api';

/** A real 1×1 PNG: uploads are checked by content, not by name. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const NAME = 'Balcony planter layout';

async function pageAs(browser: Browser, role: SessionRole): Promise<Page> {
  const context = await browser.newContext({ storageState: sessionFile(role) });
  return context.newPage();
}

async function submitVersion(page: Page, version: number, note: string): Promise<void> {
  await expect(page.getByText(`Submit version ${version}`)).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: `planter-layout-v${version}.png`,
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(page.getByText(`planter-layout-v${version}.png`)).toBeVisible();
  await page.getByLabel('Note for the reviewer').fill(note);
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText('In review', { exact: true }).first()).toBeVisible();
}

async function review(page: Page, version: number, decision: string, comment: string) {
  await page.reload();
  await expect(page.getByText(`Version ${version} of ${NAME}`)).toBeVisible();
  await page.getByLabel('Comment for the designer').fill(comment);
  await page.getByRole('button', { name: decision }).click();
}

test.describe('deliverable review loop', () => {
  let deliverableId: string;

  test.beforeAll(async () => {
    const manager = await StudioApi.as('projectManager');
    const deliverable = await manager.post<{ id: string }>('/deliverables', {
      projectId: await manager.projectId('Saska Residence'),
      taskId: null,
      name: NAME,
      description: 'Planter positions, sizes and drainage for the client balcony.',
      isRequired: false,
      reviewerUserId: await manager.personId(PEOPLE.projectManager.fullName),
    });
    deliverableId = deliverable.id;
    await manager.dispose();
  });

  test('designer submits, manager asks for changes, designer resubmits, manager approves', async ({
    browser,
  }, testInfo) => {
    const designer = await pageAs(browser, 'designer');
    const manager = await pageAs(browser, 'projectManager');

    await designer.goto(`/deliverables/${deliverableId}`);
    await expect(designer.getByRole('heading', { name: NAME })).toBeVisible();
    await expectAccessible(designer, testInfo, 'deliverable (designer)');
    await submitVersion(designer, 1, 'First layout for the client.');

    await manager.goto(`/deliverables/${deliverableId}`);
    await expectAccessible(manager, testInfo, 'deliverable (reviewer)');
    await review(manager, 1, 'Request changes', 'Show the drainage outlets on the plan.');
    await expect(manager.getByText('Changes requested', { exact: true }).first()).toBeVisible();

    await designer.reload();
    await expect(designer.getByText('Show the drainage outlets on the plan.')).toBeVisible();
    await submitVersion(designer, 2, 'Drainage outlets added.');

    await review(manager, 2, 'Approve', 'Looks right. Sending it to the client.');
    await expect(manager.getByText('Approved', { exact: true }).first()).toBeVisible();

    await designer.reload();
    await expect(designer.getByText('Approved', { exact: true }).first()).toBeVisible();
    await expect(designer.getByText(/Submit version/)).toHaveCount(0);
  });
});
