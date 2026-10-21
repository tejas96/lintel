import { expect, type Page, test } from '@playwright/test';
import { expectAccessible } from '../support/accessibility';
import { sessionFile } from '../support/people';
import { StudioApi, studioDate } from '../support/studio-api';

const SEEDED_HOLIDAYS = new Set(['2026-12-25', '2027-01-26', '2027-08-15', '2027-10-02']);

/** Two consecutive working days at least three days ahead (Mon–Fri start, no holidays). */
function leaveDays(): [string, string] {
  for (let ahead = 3; ahead < 30; ahead += 1) {
    const start = studioDate(ahead);
    const end = studioDate(ahead + 1);
    const weekday = new Date(`${start}T00:00:00Z`).getUTCDay();
    if (weekday >= 1 && weekday <= 5 && !SEEDED_HOLIDAYS.has(start) && !SEEDED_HOLIDAYS.has(end)) {
      return [start, end];
    }
  }
  throw new Error('No working days found for the leave journey.');
}

/** "Thursday 29 October 2026" — how the calendar labels its day buttons. */
function dayLabel(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(`${date}T00:00:00Z`))
    .replace(',', '');
}

async function pickDate(page: Page, field: string, date: string): Promise<void> {
  await page.getByLabel(field).click();
  const day = page.getByRole('button', { name: dayLabel(date), exact: true });
  for (let step = 0; step < 3 && !(await day.isVisible()); step += 1) {
    await page.getByRole('button', { name: 'Next month' }).click();
  }
  await day.click();
}

async function leaveStatus(id: string): Promise<string> {
  const api = await StudioApi.as('designer');
  const detail = await api.get<{ status: string }>(`/leave/requests/${id}`);
  await api.dispose();
  return detail.status;
}

async function storedRequestId(firstDay: string): Promise<string> {
  const api = await StudioApi.as('designer');
  const mine = await api.get<{ items: { id: string; startDate: string }[] }>(
    '/leave/requests?scope=mine&status=open&page=1&pageSize=20',
  );
  await api.dispose();
  const request = mine.items.find((item) => item.startDate === firstDay);
  if (!request) throw new Error('The leave request was not stored.');
  return request.id;
}

test.describe('leave request with impact preview and approval', () => {
  test('designer sees what the leave affects before sending; approvers decide in turn', async ({
    browser,
  }, testInfo) => {
    const [first, last] = leaveDays();
    const designerContext = await browser.newContext({ storageState: sessionFile('designer') });
    const designer = await designerContext.newPage();
    await designer.goto('/leave');
    await expect(designer.getByRole('heading', { name: 'Leave', exact: true })).toBeVisible();
    await expectAccessible(designer, testInfo, 'leave');

    await designer.getByRole('button', { name: 'Request leave' }).click();
    const sheet = designer.getByRole('dialog', { name: 'Request leave' });
    await expect(
      sheet.getByText('Choose the days to see how long it is and what it affects.'),
    ).toBeVisible();
    await pickDate(designer, 'First day', first);
    await pickDate(designer, 'Last day', last);
    // The live preview: duration, approvals needed and the work these days touch.
    await expect(sheet.getByText('2 days', { exact: true })).toBeVisible();
    await expect(
      sheet.getByText(/^Needs (one approval|2 approvals, one after the other)$/),
    ).toBeVisible();
    await expect(
      sheet.getByText(/^(Work affected|Nothing you own is due or planned in these days)/).first(),
    ).toBeVisible();
    await sheet.getByLabel('Reason').fill('Family wedding out of town.');
    await expectAccessible(designer, testInfo, 'request leave sheet');
    await sheet.getByRole('button', { name: 'Send request' }).click();
    await expect(sheet).toBeHidden();
    const requestId = await storedRequestId(first);

    // Level one is the designer's team lead; critical work adds the owner as level two.
    for (const approver of ['teamLead', 'owner'] as const) {
      if ((await leaveStatus(requestId)) === 'approved') break;
      const context = await browser.newContext({ storageState: sessionFile(approver) });
      const page = await context.newPage();
      await page.goto('/approvals');
      await expect(page.getByText('Leave request').first()).toBeVisible();
      await expectAccessible(page, testInfo, `approvals (${approver})`);
      await page.locator(`a[href="/leave/${requestId}"]`).click();
      await expect(page.getByRole('heading', { name: 'Your decision' })).toBeVisible();
      await expectAccessible(page, testInfo, `leave decision (${approver})`);
      await page.getByLabel('Note for them').fill('Enjoy the wedding.');
      await page.getByRole('button', { name: 'Approve leave' }).click();
      await expect(page.getByRole('heading', { name: 'Your decision' })).toBeHidden();
      await context.close();
    }
    expect(await leaveStatus(requestId)).toBe('approved');

    await designer.reload();
    await designer.locator(`a[href="/leave/${requestId}"]`).click();
    await expect(designer.getByText('Approved').first()).toBeVisible();
    await designerContext.close();
  });
});
