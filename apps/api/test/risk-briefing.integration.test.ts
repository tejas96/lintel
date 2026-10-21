import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createJourneyProject, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

let testApp: TestApp;
type Client = ReturnType<typeof client>;
const as: Record<'owner' | 'pm' | 'designer' | 'lead' | 'outsider', Client> = {} as never;
const ids = { pm: '', designer: '', lead: '' };
let projectId: string;
let lateTaskId: string;

/** "YYYY-MM-DD" in India, `days` from today. */
function indiaDate(days: number): string {
  const now = new Date(Date.now() + 5.5 * 3_600_000 + days * 86_400_000);
  return now.toISOString().slice(0, 10);
}

beforeAll(async () => {
  testApp = await createTestApp();
  as.owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
  as.pm = client(testApp, await signInAs(testApp, PEOPLE.projectManager));
  as.designer = client(testApp, await signInAs(testApp, PEOPLE.employee));
  as.lead = client(testApp, await signInAs(testApp, PEOPLE.teamLead));
  as.outsider = client(testApp, await signInAs(testApp, '9000000008'));
  ids.pm = await userIdOf(testApp, PEOPLE.projectManager);
  ids.designer = await userIdOf(testApp, PEOPLE.employee);
  ids.lead = await userIdOf(testApp, PEOPLE.teamLead);
  projectId = await createJourneyProject(as.owner, {
    pm: ids.pm,
    designer: ids.designer,
    lead: ids.lead,
    site: await userIdOf(testApp, PEOPLE.siteSupervisor),
  });
  // Time-based state the API cannot create: the designer's first task is three days overdue.
  const tasks = await as.pm.get(`/v1/tasks?projectId=${projectId}&ownerUserId=${ids.designer}`);
  lateTaskId = tasks.body.items[0].id;
  await testApp.database.pool.query(
    `UPDATE tasks SET status = 'in_progress', planned_start_date = $2, due_date = $3, started_at = now() WHERE id = $1`,
    [lateTaskId, indiaDate(-6), indiaDate(-3)],
  );
});

afterAll(async () => {
  await testApp.close();
});

describe('command center briefing', () => {
  it('gives owners the health score, its contributors with links, and the deadlines window', async () => {
    const response = await as.owner.get('/v1/dashboard/briefing').expect(200);
    const { health, deadlines } = response.body;
    expect(health.formula).toBe('health-v1');
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(100);
    expect(health.components).toHaveLength(5);
    expect(health.contributors.length).toBeLessThanOrEqual(3);
    for (const part of health.contributors) expect(part.link.linkPath).toMatch(/^\//);
    expect(health.trend.scopeKey).toBe('studio');
    expect(deadlines.range).toEqual({ start: indiaDate(1), end: indiaDate(7) });
  });

  it('shows the overdue work as a risk card with who acts and when it escalates', async () => {
    const response = await as.owner
      .get(`/v1/dashboard/briefing?projectId=${projectId}`)
      .expect(200);
    const card = response.body.riskCards.find(
      (item: { task: { id: string } | null }) => item.task?.id === lateTaskId,
    );
    expect(card).toMatchObject({
      rule: 'overdue',
      project: { id: projectId },
      responsible: { role: 'task_owner', user: { id: ids.designer } },
      escalation: { audience: 'project_manager' },
      nextAction: { linkPath: `/tasks/${lateTaskId}` },
    });
    expect(response.body.health.trend.scopeKey).toBeNull();
  });

  it('scopes a project manager to their projects and refuses people without the command center', async () => {
    const managed = await as.pm.get('/v1/dashboard/briefing').expect(200);
    const result = await testApp.database.pool.query(
      'SELECT id FROM projects WHERE manager_user_id = $1',
      [ids.pm],
    );
    const own = new Set(result.rows.map((row: { id: string }) => row.id));
    expect(managed.body.riskCards.length).toBeGreaterThan(0);
    for (const card of managed.body.riskCards) expect(own.has(card.project.id)).toBe(true);
    expect(managed.body.health.trend.scopeKey).toBe(`manager:${ids.pm}`);
    await as.designer.get('/v1/dashboard/briefing').expect(403);
  });
});

describe('project risk cards', () => {
  it('are shown to people on the project and hidden (404) from everyone else', async () => {
    const forDesigner = await as.designer.get(`/v1/projects/${projectId}/risks`).expect(200);
    expect(forDesigner.body.cards.some((card: { rule: string }) => card.rule === 'overdue')).toBe(
      true,
    );
    await as.outsider.get(`/v1/projects/${projectId}/risks`).expect(404);
    await as.owner.get('/v1/projects/00000000-0000-4000-8000-000000000000/risks').expect(404);
  });
});

describe('cover suggestions for an absence', () => {
  it('suggest cover to the project manager only, never the absent person or the reviewer', async () => {
    const tasks = await as.designer
      .get(`/v1/tasks?projectId=${projectId}&ownerUserId=${ids.designer}`)
      .expect(200);
    const task = tasks.body.items.find(
      (item: { id: string; dueDate: string | null }) => item.id !== lateTaskId && item.dueDate,
    );
    // Earlier runs use the same dates: their requests would overlap this one.
    await testApp.database.pool.query(
      `UPDATE leave_requests SET status = 'cancelled' WHERE user_id = $1 AND status IN ('pending', 'info_requested', 'approved') AND start_date <= $2 AND end_date >= $2`,
      [ids.designer, task.dueDate],
    );
    const types = await as.designer.get('/v1/leave/types').expect(200);
    const casual = types.body.find((type: { code: string }) => type.code === 'casual');
    const requested = await as.designer
      .post('/v1/leave/requests', {
        leaveTypeId: casual.id,
        startDate: task.dueDate,
        endDate: task.dueDate,
        dayPortion: 'full',
        reason: 'Family function',
        handovers: [],
      })
      .expect(201);
    const path = `/v1/leave/requests/${requested.body.id}/cover-suggestions`;

    const forPm = await as.pm.get(path).expect(200);
    const entry = forPm.body.tasks.find(
      (item: { task: { id: string } }) => item.task.id === task.id,
    );
    expect(entry).toBeDefined();
    const suggested = entry.suggestions.map((item: { user: { id: string } }) => item.user.id);
    expect(suggested).not.toContain(ids.designer);
    const detail = await as.pm.get(`/v1/tasks/${task.id}`).expect(200);
    if (detail.body.reviewer) expect(suggested).not.toContain(detail.body.reviewer.id);
    for (const suggestion of entry.suggestions)
      expect(suggestion.reasons.length).toBeGreaterThan(0);

    // The requester and the approver see the request but manage no project: no suggestions.
    expect((await as.designer.get(path).expect(200)).body.tasks).toEqual([]);
    expect((await as.lead.get(path).expect(200)).body.tasks).toEqual([]);
    await as.outsider.get(path).expect(404);

    // Nothing was reassigned.
    const after = await as.pm.get(`/v1/tasks/${task.id}`).expect(200);
    expect(after.body.owner.id).toBe(ids.designer);
    await as.designer
      .post(`/v1/leave/requests/${requested.body.id}/cancel`, {
        note: 'Plans changed',
        version: requested.body.version,
      })
      .expect(200);
  });
});
