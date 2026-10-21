import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createJourneyProject, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

/**
 * A scope change's cost and fee (seen only by people who can see the
 * budget) and the client's sign-off, which approval waits for. Approval
 * records the cost on the ledger and adds the fee to the budget.
 */
let testApp: TestApp;
type Client = ReturnType<typeof client>;
const as: Record<'owner' | 'pm' | 'designer' | 'outsider', Client> = {} as never;
let projectId = '';
let firstTask = { id: '', dueDate: '' };
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

async function setProfitability(enabled: boolean): Promise<void> {
  const organization = await as.owner.get('/v1/settings/organization').expect(200);
  await as.owner
    .put('/v1/settings/organization', { ...organization.body, profitabilityEnabled: enabled })
    .expect(200);
}

function proposal(overrides: object = {}) {
  return {
    title: 'Add a terrace pergola',
    description: 'The client asked for a pergola on the terrace.',
    taskShifts: [{ taskId: firstTask.id, shiftWorkingDays: 1 }],
    newTasks: [],
    cancelTaskIds: [],
    ...overrides,
  };
}

beforeAll(async () => {
  testApp = await createTestApp();
  as.owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
  as.pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
  as.designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
  as.outsider = client(testApp, await signInAs(testApp, '9000000008'));
  projectId = await createJourneyProject(as.owner, {
    pm: await userIdOf(testApp, PEOPLE.projectManager),
    designer: await userIdOf(testApp, PEOPLE.employee),
    lead: await userIdOf(testApp, PEOPLE.teamLead),
    site: await userIdOf(testApp, PEOPLE.siteSupervisor),
  });
  const tasks = await as.pm.get(`/v1/tasks?projectId=${projectId}&pageSize=100`).expect(200);
  firstTask = tasks.body.items[0];
  await setProfitability(true);
});

afterAll(async () => {
  await setProfitability(false);
  await testApp.close();
});

describe('the money side of a scope change', () => {
  it('lets only people who can see the budget add a cost or fee', async () => {
    const refused = await as.designer
      .post(`/v1/projects/${projectId}/scope-changes`, proposal({ costImpactMinor: 1_000_00 }))
      .expect(403);
    expect(refused.body.message).toMatch(/budget/);
  });

  it('hides the money from members who cannot see the budget', async () => {
    const created = await as.pm
      .post(
        `/v1/projects/${projectId}/scope-changes`,
        proposal({
          costImpactMinor: 45_000_00,
          costCategory: 'material',
          feeImpactMinor: 60_000_00,
          requiresClientSignOff: true,
        }),
      )
      .expect(201);
    expect(created.body.money).toEqual({
      costImpactMinor: 45_000_00,
      costCategory: 'material',
      feeImpactMinor: 60_000_00,
    });
    expect(created.body.requiresClientSignOff).toBe(true);
    const seenByDesigner = await as.designer
      .get(`/v1/projects/${projectId}/scope-changes`)
      .expect(200);
    expect(seenByDesigner.body[0].money).toBeNull();
    const activity = await as.designer.get(`/v1/projects/${projectId}/activity`).expect(200);
    expect(JSON.stringify(activity.body)).not.toContain('4500000');
    await as.outsider.get(`/v1/projects/${projectId}/scope-changes`).expect(404);
  });
});

describe('client sign-off', () => {
  it('waits for the sign-off, keeps every record, then applies the money', async () => {
    const [change] = (await as.pm.get(`/v1/projects/${projectId}/scope-changes`).expect(200)).body;
    const blocked = await as.owner
      .post(`/v1/scope-changes/${change.id}/decision`, {
        decision: 'approved',
        note: 'Agreed with the client',
        version: change.version,
      })
      .expect(422);
    expect(blocked.body.message).toMatch(/client has not signed off/);
    const signOff = {
      confirmedByName: 'Meera Rao',
      method: 'meeting',
      confirmedOn: today,
      note: 'Site meeting',
    };
    await as.designer.post(`/v1/scope-changes/${change.id}/client-sign-offs`, signOff).expect(403);
    await as.outsider.post(`/v1/scope-changes/${change.id}/client-sign-offs`, signOff).expect(404);
    await as.pm
      .post(`/v1/scope-changes/${change.id}/client-sign-offs`, {
        ...signOff,
        confirmedOn: '2099-01-01',
      })
      .expect(400);
    await as.pm.post(`/v1/scope-changes/${change.id}/client-sign-offs`, signOff).expect(201);
    const corrected = await as.pm
      .post(`/v1/scope-changes/${change.id}/client-sign-offs`, { ...signOff, method: 'email' })
      .expect(201);
    expect(corrected.body.clientSignOffs.map((entry: { method: string }) => entry.method)).toEqual([
      'email',
      'meeting',
    ]);
    const before = await as.owner.get(`/v1/projects/${projectId}`).expect(200);
    const approved = await as.owner
      .post(`/v1/scope-changes/${change.id}/decision`, {
        decision: 'approved',
        note: 'Agreed with the client',
        version: change.version,
      })
      .expect(200);
    expect(approved.body.status).toBe('approved');
    const after = await as.owner.get(`/v1/projects/${projectId}`).expect(200);
    expect(after.body.budgetMinor).toBe(before.body.budgetMinor + 60_000_00);
    const profitability = await as.owner.get(`/v1/projects/${projectId}/profitability`).expect(200);
    const entry = profitability.body.entries.find(
      (item: { scopeChangeId: string | null }) => item.scopeChangeId === change.id,
    );
    expect(entry).toMatchObject({ amountMinor: 45_000_00, category: 'material' });
    expect(profitability.body.recordedCostMinor).toBeGreaterThanOrEqual(45_000_00);
  });

  it('refuses a sign-off once the change is decided', async () => {
    const [change] = (await as.pm.get(`/v1/projects/${projectId}/scope-changes`).expect(200)).body;
    await as.pm
      .post(`/v1/scope-changes/${change.id}/client-sign-offs`, {
        confirmedByName: 'Meera Rao',
        method: 'call',
        confirmedOn: today,
        note: null,
      })
      .expect(422);
  });
});
