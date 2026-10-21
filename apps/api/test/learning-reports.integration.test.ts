import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createJourneyProject, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

/**
 * The estimate, rework and delay reports through the real API: who may read
 * them, the project manager's narrower view, and their CSV downloads.
 */
let testApp: TestApp;
const SECOND_MANAGER = '9000000004';
const ids = { pm: '', pm2: '', designer: '', lead: '', site: '', file: '' };
const projects = { mine: '', theirs: '' };
const stamp = `${Date.now()}`;
const FORMULA = `=HYPERLINK("http://example.invalid","Learning ${stamp}")`;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const REPORTS = [
  { name: 'estimates', title: 'estimate-accuracy' },
  { name: 'rework', title: 'rework-rate' },
  { name: 'delays', title: 'approval-delays' },
] as const;

async function sql(text: string, values: unknown[] = []): Promise<Record<string, string>[]> {
  const result = await testApp.database.pool.query(text, values);
  return result.rows as Record<string, string>[];
}

/**
 * Today on the project: one task finished with an hour estimated and logged
 * (its title is the task type's name), a deliverable version sent back after
 * a day, and a client blocker resolved after three days.
 */
async function recordHistory(projectId: string, title: string, taskType: string): Promise<void> {
  const [task] = await sql(
    `UPDATE tasks SET status = 'done', completed_at = now(), estimate_minutes = 60,
            template_key = $2, title = $3
      WHERE id = (SELECT id FROM tasks WHERE project_id = $1 ORDER BY number LIMIT 1)
      RETURNING id`,
    [projectId, taskType, title],
  );
  if (!task) throw new Error('No task to finish');
  await sql(
    `INSERT INTO work_sessions (task_id, user_id, started_at, ended_at)
     VALUES ($1, $2, now() - interval '61 minutes', now() - interval '1 minute')`,
    [task.id, ids.designer],
  );
  const [deliverable] = await sql(
    `INSERT INTO deliverables (project_id, task_id, name, status, current_version_number)
     VALUES ($1, $2, 'Learning drawing', 'changes_requested', 1) RETURNING id`,
    [projectId, task.id],
  );
  await sql(
    `INSERT INTO deliverable_versions (deliverable_id, version_number, file_id, submitted_by_user_id,
       created_at, decision, reviewed_by_user_id, reviewed_at)
     VALUES ($1, 1, $2, $3, now() - interval '1 day', 'changes_requested', $4, now())`,
    [deliverable?.id, ids.file, ids.designer, ids.pm],
  );
  await sql(
    `INSERT INTO task_blockers (task_id, category, reason, raised_by_user_id, created_at, resolved_at)
     VALUES ($1, 'client', 'Waiting for the tile choice', $2, now() - interval '3 days', now())`,
    [task.id, ids.pm],
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
  const [file] = await sql(
    `INSERT INTO files (storage_key, original_name, content_type, size_bytes, checksum_sha256,
       uploaded_by_user_id)
     VALUES ($1, 'learning.pdf', 'application/pdf', 1, $2, $3) RETURNING id`,
    [`fixture/${randomUUID()}.pdf`, '0'.repeat(64), ids.designer],
  );
  ids.file = file?.id ?? '';
  // Task types the template does not know, so each is named by its task's title.
  await recordHistory(projects.mine, `Kitchen layout ${stamp}`, `kitchen-${stamp}`);
  await recordHistory(projects.theirs, FORMULA, `formula-${stamp}`);
  await sql('UPDATE projects SET name = $2, client_name = $2 WHERE id = $1', [
    projects.theirs,
    FORMULA,
  ]);
});

afterAll(async () => {
  await testApp.close();
});

describe('learning reports: access', () => {
  it('refuses people who neither lead the studio nor manage projects', async () => {
    const designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
    for (const report of REPORTS) {
      await designer.get(`/v1/reports/${report.name}`).expect(403);
      await designer.get(`/v1/reports/${report.name}/csv`).expect(403);
    }
  });

  it('shows the owner the studio with the formulas applied', async () => {
    const owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
    const query = `?from=${today}&to=${today}&projectId=${projects.mine}`;
    const estimates = await owner.get(`/v1/reports/estimates${query}`).expect(200);
    expect(estimates.body.scope).toBe('business');
    expect(estimates.body.totals).toMatchObject({ measured: 1, effortRatio: 1, within: 1 });
    expect(estimates.body.byTaskType[0].name).toBe(`Kitchen layout ${stamp}`);
    const rework = await owner.get(`/v1/reports/rework${query}`).expect(200);
    expect(rework.body.totals).toMatchObject({ reviewed: 1, sentBack: 1, reworkRate: 1 });
    expect(rework.body.mostSentBack[0]).toMatchObject({ kind: 'task', sentBack: 1 });
    const delays = await owner.get(`/v1/reports/delays${query}`).expect(200);
    const kind = (name: string) =>
      delays.body.kinds.find((row: { kind: string }) => row.kind === name);
    expect(kind('client_wait')).toMatchObject({ count: 1, delayed: 1, medianHours: 72 });
    expect(kind('internal_review')).toMatchObject({ count: 1, delayed: 0, medianHours: 24 });
  });

  it('limits a project manager to the projects they manage', async () => {
    const pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
    for (const report of REPORTS) {
      await pm.get(`/v1/reports/${report.name}?projectId=${projects.theirs}`).expect(404);
      await pm.get(`/v1/reports/${report.name}/csv?projectId=${projects.theirs}`).expect(404);
    }
    const range = `?from=${today}&to=${today}`;
    const projectIds = (rows: { project: { id: string } }[]) => rows.map((row) => row.project.id);
    const rework = await pm.get(`/v1/reports/rework${range}`).expect(200);
    expect(rework.body.scope).toBe('managed');
    expect(projectIds(rework.body.byProject)).toContain(projects.mine);
    expect(projectIds(rework.body.byProject)).not.toContain(projects.theirs);
    const delays = await pm.get(`/v1/reports/delays${range}`).expect(200);
    expect(projectIds(delays.body.byProject)).toContain(projects.mine);
    expect(projectIds(delays.body.byProject)).not.toContain(projects.theirs);
    const estimates = await pm.get(`/v1/reports/estimates${range}`).expect(200);
    const names = estimates.body.byTaskType.map((row: { name: string }) => row.name);
    expect(names).toContain(`Kitchen layout ${stamp}`);
    expect(names).not.toContain(FORMULA);
  });
});

describe('learning reports: CSV download', () => {
  async function download(path: string) {
    const owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
    return owner
      .get(path)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
  }

  it.each(REPORTS)('serves $name as a formula-safe attachment', async ({ name, title }) => {
    const response = await download(`/v1/reports/${name}/csv?from=${today}&to=${today}`);
    const file = `lintel-${title}-${today}-to-${today}.csv`;
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="${file}"; filename*=UTF-8''${file}`,
    );
    expect(response.headers['cache-control']).toBe('private, no-store');
    const bytes = response.body as Buffer;
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = bytes.toString('utf8').slice(1);
    // CRLF line endings throughout, no bare line feeds.
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.split('\n').length).toBe(text.split('\r\n').length);
    expect(text.split('\r\n').length).toBeGreaterThan(2);
    expect(text).toContain(`"'=HYPERLINK(""http://example.invalid"",""Learning ${stamp}"")"`);
    expect(text).not.toMatch(/(^|,)=HYPERLINK/m);
  });

  it('gives a project manager only their own rows', async () => {
    const pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
    for (const report of REPORTS) {
      const response = await pm.get(`/v1/reports/${report.name}/csv?from=${today}&to=${today}`);
      expect(response.status).toBe(200);
      expect(response.text).not.toContain(`Learning ${stamp}`);
    }
  });
});
