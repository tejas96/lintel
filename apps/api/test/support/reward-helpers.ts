import type { MilestoneRewardShare } from '@lintel/api-contracts';
import { expect } from 'vitest';
import { type client, createJourneyProject, userIdOf } from './journey-helpers';
import { PEOPLE, signInAs, type TestApp } from './test-app';

type Client = ReturnType<typeof client>;

export const COLLEAGUE = '9000000007';

export interface RewardPeople {
  readonly owner: Client;
  readonly admin: Client;
  readonly pm: Client;
  readonly designer: Client;
  readonly lead: Client;
  readonly colleague: Client;
  readonly ids: { pm: string; designer: string; lead: string; site: string; colleague: string };
}

/** Signs everyone in once: owner (decides), admin (plans), pm, two recipients and an outsider. */
export async function rewardPeople(
  testApp: TestApp,
  as: (token: string) => Client,
): Promise<RewardPeople> {
  return {
    owner: as(await signInAs(testApp, PEOPLE.owner)),
    admin: as(await signInAs(testApp, PEOPLE.administrator)),
    pm: as(await signInAs(testApp, PEOPLE.projectManager)),
    designer: as(await signInAs(testApp, PEOPLE.employee)),
    lead: as(await signInAs(testApp, PEOPLE.teamLead)),
    colleague: as(await signInAs(testApp, COLLEAGUE)),
    ids: {
      pm: await userIdOf(testApp, PEOPLE.projectManager),
      designer: await userIdOf(testApp, PEOPLE.employee),
      lead: await userIdOf(testApp, PEOPLE.teamLead),
      site: await userIdOf(testApp, PEOPLE.siteSupervisor),
      colleague: await userIdOf(testApp, COLLEAGUE),
    },
  };
}

/** A fresh project and its first open milestone. */
export async function projectWithMilestone(people: RewardPeople) {
  const projectId = await createJourneyProject(people.owner, people.ids);
  const detail = await people.owner.get(`/v1/projects/${projectId}`).expect(200);
  const milestone = detail.body.milestones.find(
    (item: { status: string }) => item.status === 'pending',
  );
  expect(milestone).toBeDefined();
  return { projectId, milestoneId: milestone.id as string };
}

/** A shared reward for the designer and the lead, attached by the administrator. */
export async function attachSharedReward(people: RewardPeople, milestoneId: string) {
  const saved = await people.admin
    .put(`/v1/milestones/${milestoneId}/reward`, {
      scope: 'team',
      recipientUserIds: [people.ids.designer, people.ids.lead],
      amountMinor: 400_001,
      requiredDocumentFolders: [],
      note: 'Sign-off on time',
      version: null,
    })
    .expect(200);
  return saved.body;
}

/** Closes the milestone's work directly, then the project manager completes it. */
export async function completeMilestone(
  testApp: TestApp,
  people: RewardPeople,
  milestoneId: string,
) {
  await testApp.database.pool.query(
    `UPDATE tasks SET status = 'done', completed_at = now()
      WHERE milestone_id = $1 AND status NOT IN ('done', 'cancelled')`,
    [milestoneId],
  );
  const { rows } = await testApp.database.pool.query(
    'SELECT version, project_id FROM milestones WHERE id = $1',
    [milestoneId],
  );
  const row = rows[0] as { version: number };
  await people.pm
    .post(`/v1/milestones/${milestoneId}/complete`, { note: null, version: row.version })
    .expect(200);
}

/** The pending milestone shares of a plan, as the owner sees them. */
export async function sharesOf(people: RewardPeople, planId: string) {
  const all = await people.owner.get('/v1/rewards/milestones?scope=all&pageSize=100').expect(200);
  const items: MilestoneRewardShare[] = all.body.items;
  return items.filter((item) => item.planId === planId);
}
