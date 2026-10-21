import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createJourneyProject, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

/**
 * Reports through the real API: who may read them, the project manager's
 * narrower view, and the CSV download (headers, BOM, formula-safe cells).
 */
let testApp: TestApp;
const SECOND_MANAGER = '9000000004';
const ids = { pm: '', pm2: '', designer: '', lead: '', site: '' };
const projects = { mine: '', theirs: '' };
/** Today in the studio timezone (the seeded default), as the API sees it. */
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

/** Marks one dated task of the project done, late by a day, so delivery numbers exist. */
async function finishOneTaskLate(projectId: string): Promise<void> {
  await testApp.database.pool.query(
    `UPDATE tasks SET status = 'done', due_date = $2::date - 1, completed_at = now()
      WHERE id = (SELECT id FROM tasks WHERE project_id = $1 AND due_date IS NOT NULL
                  ORDER BY number LIMIT 1)`,
    [projectId, today],
  );
}

beforeAll(async () => {
  testApp = await createTestApp();
  ids.pm = await userIdOf(testApp, PEOPLE.projectManager);
  ids.pm2 = await userIdOf(testApp, SECOND_MANAGER);
  ids.designer = await userIdOf(testApp, PEOPLE.employee);
  ids.lead = await userIdOf(testApp, PEOPLE.teamLead);
  ids.site = await userIdOf(testApp, PEOPLE.siteSupervisor);
  const owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
  projects.mine = await createJourneyProject(owner, ids);
  projects.theirs = await createJourneyProject(owner, { ...ids, pm: ids.pm2 });
  await finishOneTaskLate(projects.mine);
  await finishOneTaskLate(projects.theirs);
  await testApp.database.pool.query('UPDATE projects SET name = $2 WHERE id = $1', [
    projects.theirs,
    `=HYPERLINK("http://example.invalid","Report ${Date.now()}")`,
  ]);
});

afterAll(async () => {
  await testApp.close();
});

const REPORTS = ['delivery', 'workload', 'leave', 'approvals'] as const;

describe('report access', () => {
  it('refuses people who neither lead the studio nor manage projects', async () => {
    const designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
    for (const report of REPORTS) {
      await designer.get(`/v1/reports/${report}`).expect(403);
      await designer.get(`/v1/reports/${report}/csv`).expect(403);
    }
    const site = client(testApp, await signInAs(testApp, PEOPLE.siteSupervisor));
    await site.get('/v1/reports/delivery').expect(403);
  });

  it('shows the owner every project, with the delivery formulas applied', async () => {
    const owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
    const report = await owner.get(`/v1/reports/delivery?from=${today}&to=${today}`).expect(200);
    expect(report.body.scope).toBe('business');
    const projectIds = report.body.byProject.map(
      (row: { project: { id: string } }) => row.project.id,
    );
    expect(projectIds).toEqual(expect.arrayContaining([projects.mine, projects.theirs]));
    const mine = report.body.byProject.find(
      (row: { project: { id: string } }) => row.project.id === projects.mine,
    );
    expect(mine.tasks).toMatchObject({ onTime: 0, late: 1, onTimeRate: 0, averageDaysLate: 1 });
    for (const name of REPORTS) await owner.get(`/v1/reports/${name}`).expect(200);
  });

  it('limits a project manager to the projects they manage', async () => {
    const pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
    const report = await pm.get(`/v1/reports/delivery?from=${today}&to=${today}`).expect(200);
    expect(report.body.scope).toBe('managed');
    const projectIds = report.body.byProject.map(
      (row: { project: { id: string } }) => row.project.id,
    );
    expect(projectIds).toContain(projects.mine);
    expect(projectIds).not.toContain(projects.theirs);
    // Asking for someone else's project, or one that does not exist, answers 404.
    await pm.get(`/v1/reports/delivery?projectId=${projects.theirs}`).expect(404);
    await pm.get('/v1/reports/delivery?projectId=00000000-0000-4000-8000-000000000000').expect(404);
    // Filtering by another manager cannot widen the view.
    const widened = await pm.get(`/v1/reports/delivery?managerUserId=${ids.pm2}`).expect(200);
    expect(
      widened.body.byProject.some(
        (row: { project: { id: string } }) => row.project.id === projects.theirs,
      ),
    ).toBe(false);
    const approvals = await pm.get('/v1/reports/approvals').expect(200);
    expect(approvals.body.scope).toBe('managed');
  });

  it('validates the range', async () => {
    const owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
    await owner.get('/v1/reports/workload?from=2026-10-22&to=2026-10-01').expect(400);
    await owner.get('/v1/reports/workload?from=2024-01-01&to=2026-10-01').expect(400);
    await owner.get('/v1/reports/workload?from=2026-02-30').expect(400);
    await owner.get('/v1/reports/unknown/csv').expect(404);
  });
});

describe('report CSV download', () => {
  it('serves UTF-8 with a BOM as an attachment, with formula-safe cells', async () => {
    const owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
    const response = await owner
      .get(`/v1/reports/delivery/csv?from=${today}&to=${today}`)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="lintel-delivery-reliability-${today}-to-${today}.csv"; filename*=UTF-8''lintel-delivery-reliability-${today}-to-${today}.csv`,
    );
    expect(response.headers['cache-control']).toBe('private, no-store');
    const bytes = response.body as Buffer;
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = bytes.toString('utf8').slice(1);
    const lines = text.split('\r\n');
    expect(lines[0]).toBe(
      'Group,Name,Detail,Work,On time,Late,Still open past due,On-time rate %,Average days late',
    );
    expect(text).toContain(`"'=HYPERLINK(""http://example.invalid"",""Report `);
    expect(text).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(text.endsWith('\r\n')).toBe(true);
  });

  it('gives a project manager only their own rows', async () => {
    const pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
    const response = await pm.get(`/v1/reports/delivery/csv?from=${today}&to=${today}`).expect(200);
    expect(response.text).not.toContain('HYPERLINK');
  });
});
