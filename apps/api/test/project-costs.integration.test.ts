import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createJourneyProject, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

/**
 * Profitability through the real API: off by default and then hidden, who
 * may read and record costs, voiding, the audit trail and the command center.
 */
let testApp: TestApp;
type Client = ReturnType<typeof client>;
const ids = { pm: '', pm2: '', designer: '', lead: '', site: '' };
const projects = { mine: '', theirs: '' };
/** Today in the studio timezone (the seeded default), as the API sees it. */
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

async function setProfitability(owner: Client, enabled: boolean): Promise<void> {
  const organization = await owner.get('/v1/settings/organization').expect(200);
  const updated = await owner
    .put('/v1/settings/organization', { ...organization.body, profitabilityEnabled: enabled })
    .expect(200);
  expect(updated.body.profitabilityEnabled).toBe(enabled);
}

const cost = (amountMinor: number) => ({
  entryDate: today,
  category: 'material',
  amountMinor,
  note: 'Veneer sheets',
});

beforeAll(async () => {
  testApp = await createTestApp();
  ids.pm = await userIdOf(testApp, PEOPLE.projectManager);
  ids.pm2 = await userIdOf(testApp, '9000000004');
  ids.designer = await userIdOf(testApp, PEOPLE.employee);
  ids.lead = await userIdOf(testApp, PEOPLE.teamLead);
  ids.site = await userIdOf(testApp, PEOPLE.siteSupervisor);
  const owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
  await setProfitability(owner, false);
  projects.mine = await createJourneyProject(owner, ids);
  projects.theirs = await createJourneyProject(owner, { ...ids, pm: ids.pm2 });
});

afterAll(async () => {
  const owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
  await setProfitability(owner, false);
  await testApp.close();
});

describe('profitability switched off (the default)', () => {
  it('hides budgets and costs everywhere and refuses to record', async () => {
    const owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
    await owner.get(`/v1/projects/${projects.mine}/profitability`).expect(404);
    const refused = await owner.post(`/v1/projects/${projects.mine}/costs`, cost(10_000_00));
    expect(refused.status).toBe(422);
    expect(refused.body.message).toMatch(/switched off/i);
    const center = await owner.get('/v1/dashboard/command-center').expect(200);
    expect(center.body.profitability).toBeNull();
  });
});

describe('profitability switched on', () => {
  it('lets finance people record, read and void costs, audited', async () => {
    const owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
    await setProfitability(owner, true);
    const pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));

    const first = await owner.post(`/v1/projects/${projects.mine}/costs`, cost(40_000_00));
    expect(first.status).toBe(201);
    const second = await pm.post(`/v1/projects/${projects.mine}/costs`, {
      ...cost(15_000_00),
      category: 'consultant',
      note: null,
    });
    expect(second.status).toBe(201);
    expect(second.body.recordedBy.id).toBe(ids.pm);

    const view = await pm.get(`/v1/projects/${projects.mine}/profitability`).expect(200);
    // Budget 2,50,000.00 (journey project) − 55,000.00 recorded.
    expect(view.body).toMatchObject({
      budgetMinor: 250_000_00,
      recordedCostMinor: 55_000_00,
      remainingMinor: 195_000_00,
      marginRatio: 0.78,
      indicator: 'healthy',
      entryCount: 2,
    });

    const voided = await owner
      .post(`/v1/projects/${projects.mine}/costs/${first.body.id}/void`, {
        reason: 'Entered twice by mistake',
        version: first.body.version,
      })
      .expect(200);
    expect(voided.body.voidedBy.fullName).toBeTruthy();
    const again = await owner.post(`/v1/projects/${projects.mine}/costs/${first.body.id}/void`, {
      reason: 'Entered twice by mistake',
      version: voided.body.version,
    });
    expect(again.status).toBe(422);
    const after = await owner.get(`/v1/projects/${projects.mine}/profitability`).expect(200);
    expect(after.body.recordedCostMinor).toBe(15_000_00);
    expect(after.body.entries).toHaveLength(2);

    const audit = await testApp.database.pool.query(
      `SELECT action FROM audit_log WHERE entity_type = 'project_cost' AND entity_id = $1
        ORDER BY created_at`,
      [first.body.id],
    );
    expect(audit.rows.map((row: { action: string }) => row.action)).toEqual([
      'project_cost.recorded',
      'project_cost.voided',
    ]);
  });

  it('hides costs from people who cannot see the budget, as not found', async () => {
    const designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
    await designer.get(`/v1/projects/${projects.mine}/profitability`).expect(404);
    await designer.post(`/v1/projects/${projects.mine}/costs`, cost(1_00)).expect(404);
    const detail = await designer.get(`/v1/projects/${projects.mine}`).expect(200);
    expect(detail.body.budgetMinor).toBeNull();

    const pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
    await pm.get(`/v1/projects/${projects.theirs}/profitability`).expect(404);
    await pm.post(`/v1/projects/${projects.theirs}/costs`, cost(1_00)).expect(404);
  });

  it('validates entries', async () => {
    const owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
    await owner.post(`/v1/projects/${projects.mine}/costs`, cost(0)).expect(400);
    await owner
      .post(`/v1/projects/${projects.mine}/costs`, { ...cost(5_00), category: 'snacks' })
      .expect(400);
    const future = await owner.post(`/v1/projects/${projects.mine}/costs`, {
      ...cost(5_00),
      entryDate: '2999-01-01',
    });
    expect(future.status).toBe(400);
    expect(future.body.details[0].field).toBe('entryDate');
  });

  it('adds budget against cost to the command center for people who may see budgets', async () => {
    const owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
    const center = await owner.get('/v1/dashboard/command-center').expect(200);
    const portfolio = center.body.profitability;
    expect(portfolio).not.toBeNull();
    const row = portfolio.projects.find(
      (item: { project: { id: string } }) => item.project.id === projects.mine,
    );
    expect(row).toMatchObject({ recordedCostMinor: 15_000_00, indicator: 'healthy' });

    const pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
    const managed = await pm.get('/v1/dashboard/command-center').expect(200);
    const visible = managed.body.profitability.projects.map(
      (item: { project: { id: string } }) => item.project.id,
    );
    expect(visible).toContain(projects.mine);
    expect(visible).not.toContain(projects.theirs);
  });
});
