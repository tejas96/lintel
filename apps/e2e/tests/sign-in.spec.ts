import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/accessibility';
import { E2E } from '../support/environment';
import { PEOPLE } from '../support/people';

test.describe('sign-in with a one-time code', () => {
  test('asks for the number, refuses a wrong code, then signs in and opens Today', async ({
    page,
  }, testInfo) => {
    const person = PEOPLE.siteSupervisor;
    await page.goto('/today');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Ftoday/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expectAccessible(page, testInfo, 'sign-in: phone number');

    await page.getByLabel('Mobile number').fill(person.nationalNumber);
    await page.getByRole('button', { name: 'Text me a code' }).click();
    await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible();
    await expect(page.getByText('+91 •••••• 0010')).toBeVisible();
    await expectAccessible(page, testInfo, 'sign-in: code');

    // A wrong code is refused with a generic message and the boxes clear for another try.
    await page.getByLabel('Digit 1 of 6').pressSequentially('000000');
    await expect(
      page.getByRole('alert').filter({ hasText: 'That code is incorrect or has expired.' }),
    ).toBeVisible();
    await expect(page.getByLabel('Digit 1 of 6')).toHaveValue('');

    await page.getByLabel('Digit 1 of 6').pressSequentially(E2E.otpCode);
    await expect(page).toHaveURL(/\/today$/, { timeout: 15_000 });
    await expect(
      page.getByRole('heading', { name: /Good (morning|afternoon|evening), Vikram/ }),
    ).toBeVisible();

    // Signing out also unregisters this browser from push (nothing to do here) and ends the session.
    await page.getByRole('button', { name: new RegExp(person.fullName) }).click();
    await page
      .getByRole('menuitem', { name: 'Sign out' })
      .or(page.getByRole('button', { name: 'Sign out' }))
      .click();
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goto('/today');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
