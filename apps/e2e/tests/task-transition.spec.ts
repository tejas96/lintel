import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/accessibility';
import { PEOPLE, sessionFile } from '../support/people';
import { StudioApi, studioDate } from '../support/studio-api';

test.use({ storageState: sessionFile('designer') });

test.describe('task status changes', () => {
  let taskId: string;

  test.beforeAll(async () => {
    // The project manager gives the designer a task with two required checklist items.
    const manager = await StudioApi.as('projectManager');
    const task = await manager.post<{ id: string }>('/tasks', {
      projectId: await manager.projectId('Saska Residence'),
      stageId: null,
      milestoneId: null,
      parentTaskId: null,
      title: 'Measure the balcony for planters',
      description: 'Site visit before the planter order goes out.',
      priority: 'medium',
      ownerUserId: await manager.personId(PEOPLE.designer.fullName),
      reviewerUserId: null,
      collaboratorUserIds: [],
      plannedStartDate: studioDate(0),
      dueDate: studioDate(3),
      estimateMinutes: 90,
      requiresReview: false,
      completionCriteria: null,
      checklist: [
        { label: 'Balcony measured', isRequired: true },
        { label: 'Drainage points photographed', isRequired: true },
      ],
      publish: true,
    });
    taskId = task.id;
    await manager.dispose();
  });

  test('explains why a move is refused, then allows it once the reason is gone', async ({
    page,
  }, testInfo) => {
    await page.goto(`/tasks/${taskId}`);
    await expect(
      page.getByRole('heading', { name: 'Measure the balcony for planters' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Acknowledge' }).click();
    await expect(page.getByRole('button', { name: 'Acknowledge' })).toHaveCount(0);
    // Starting the work timer also moves the task from ready to in progress.
    await page.getByRole('button', { name: 'Start work' }).first().click();
    await expect(page.getByRole('button', { name: /^Pause/ })).toBeVisible();
    const refusal = page.getByText(
      'Mark done isn’t available yet: 2 required checklist items are not done.',
    );
    await expect(refusal).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark done' })).toHaveCount(0);
    await expectAccessible(page, testInfo, 'task page');

    await page.getByRole('checkbox', { name: 'Balcony measured' }).click();
    await expect(
      page.getByText('Mark done isn’t available yet: 1 required checklist item is not done.'),
    ).toBeVisible();
    await page.getByRole('checkbox', { name: 'Drainage points photographed' }).click();
    await expect(page.getByText(/Mark done isn’t available yet/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Mark done' }).click();
    await expect(page.getByLabel('Task details').getByText('Done', { exact: true })).toBeVisible();
  });
});
