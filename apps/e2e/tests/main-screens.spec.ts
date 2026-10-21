import { expect, type Page, test } from '@playwright/test';
import { expectAccessible } from '../support/accessibility';
import { type SessionRole, sessionFile } from '../support/people';

interface Screen {
  readonly name: string;
  readonly path: string;
  /** Something that is only there once the screen has loaded its data. */
  readonly ready: (page: Page) => ReturnType<Page['getByRole']>;
}

const SCREENS: Readonly<Record<SessionRole, readonly Screen[]>> = {
  owner: [
    {
      name: 'projects',
      path: '/projects',
      ready: (page) => page.getByRole('link', { name: /Banyan Court Villa/ }).first(),
    },
    {
      name: 'capacity',
      path: '/capacity',
      ready: (page) => page.getByRole('heading', { name: 'Capacity', exact: true }),
    },
    {
      name: 'people',
      path: '/people',
      ready: (page) => page.getByText('Ananya Joshi').first(),
    },
    {
      name: 'account',
      path: '/account',
      ready: (page) => page.getByRole('heading', { name: 'Notifications' }),
    },
  ],
  projectManager: [
    {
      name: 'approvals',
      path: '/approvals',
      ready: (page) => page.getByRole('heading', { name: 'Approvals', exact: true }),
    },
  ],
  teamLead: [],
  designer: [
    {
      name: 'today (designer)',
      path: '/today',
      ready: (page) => page.getByText('Next priority'),
    },
  ],
};

for (const [role, screens] of Object.entries(SCREENS) as [SessionRole, readonly Screen[]][]) {
  test.describe(`main screens as ${role}`, () => {
    test.use({ storageState: sessionFile(role) });
    for (const screen of screens) {
      test(`${screen.name} has no serious accessibility problems`, async ({ page }, testInfo) => {
        await page.goto(screen.path);
        await expect(screen.ready(page)).toBeVisible();
        await expectAccessible(page, testInfo, screen.name);
      });
    }
  });
}

test.describe('dark theme', () => {
  test.use({ storageState: sessionFile('owner'), colorScheme: 'dark' });

  for (const screen of [
    { name: 'today (dark)', path: '/today', text: 'Next priority' },
    { name: 'command center (dark)', path: '/command-center', text: 'Banyan Court Villa' },
    { name: 'account (dark)', path: '/account', text: 'How each kind of notification reaches you' },
  ]) {
    test(`${screen.name} has no serious accessibility problems`, async ({ page }, testInfo) => {
      await page.goto(screen.path);
      await expect(page.getByText(screen.text).first()).toBeAttached();
      await expectAccessible(page, testInfo, screen.name);
    });
  }
});

test.describe('project detail', () => {
  test.use({ storageState: sessionFile('projectManager') });

  test('opens from the list and has no serious accessibility problems', async ({
    page,
  }, testInfo) => {
    await page.goto('/projects');
    await page
      .getByRole('link', { name: /Saska Residence/ })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: 'Saska Residence' })).toBeVisible();
    await expectAccessible(page, testInfo, 'project detail');
  });
});
