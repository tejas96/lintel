import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createJourneyProject, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

let testApp: TestApp;
let owner: ReturnType<typeof client>;
let projectId: string;
const chosen = { milestone: '', successor: '', blocked: '' };

/** "YYYY-MM-DD" in India, `days` from today. */
function indiaDate(days: number): string {
  const now = new Date(Date.now() + 5.5 * 3_600_000 + days * 86_400_000);
  return now.toISOString().slice(0, 10);
}

interface Commitment {
  readonly kind: 'milestone' | 'delivery';
  readonly id: string;
  readonly slipWorkingDays: number;
}

beforeAll(async () => {
  testApp = await createTestApp();
  owner = client(testApp, await signInAs(testApp, PEOPLE.owner));
  projectId = await createJourneyProject(owner, {
    pm: await userIdOf(testApp, PEOPLE.projectManager),
    designer: await userIdOf(testApp, PEOPLE.employee),
    lead: await userIdOf(testApp, PEOPLE.teamLead),
    site: await userIdOf(testApp, PEOPLE.siteSupervisor),
  });
  const pool = testApp.database.pool;
  const { rows } = await pool.query<{ id: string; milestone_id: string | null }>(
    'SELECT id, milestone_id FROM tasks WHERE project_id = $1 AND archived_at IS NULL ORDER BY created_at, id',
    [projectId],
  );
  const successor = rows.find((row) => row.milestone_id !== null);
  const blocked = rows.find((row) => row.milestone_id !== successor?.milestone_id);
  if (!successor?.milestone_id || !blocked) throw new Error('The template has no milestones.');
  Object.assign(chosen, {
    milestone: successor.milestone_id,
    successor: successor.id,
    blocked: blocked.id,
  });
  // Time-based state the API cannot create. The milestone is two weeks away (outside the
  // 7-day window) and holds one task, planned to finish on it, that waits on work that is
  // blocked today: the blocked work finishes on the next working day at the earliest, so
  // the successor starts late and the forecast passes the milestone.
  const due = indiaDate(14);
  await pool.query('UPDATE milestones SET due_date = $2 WHERE id = $1', [chosen.milestone, due]);
  await pool.query('UPDATE tasks SET milestone_id = NULL WHERE milestone_id = $1 AND id <> $2', [
    chosen.milestone,
    chosen.successor,
  ]);
  await pool.query(
    `UPDATE tasks SET status = 'ready', planned_start_date = $2, due_date = $3 WHERE id = $1`,
    [chosen.successor, indiaDate(1), due],
  );
  await pool.query(
    `UPDATE tasks SET status = 'blocked', planned_start_date = $2, due_date = $3 WHERE id = $1`,
    [chosen.blocked, indiaDate(-3), indiaDate(0)],
  );
  await pool.query('DELETE FROM task_dependencies WHERE task_id = ANY($1)', [
    [chosen.successor, chosen.blocked],
  ]);
  await pool.query('INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES ($1, $2)', [
    chosen.successor,
    chosen.blocked,
  ]);
});

afterAll(async () => {
  await testApp.close();
});

describe('milestone health and the schedule forecast', () => {
  it('shows a milestone pushed by a blocked prerequisite as at risk, with the slip', async () => {
    const detail = await owner.get(`/v1/projects/${projectId}`).expect(200);
    const milestone = detail.body.milestones.find(
      (item: { id: string }) => item.id === chosen.milestone,
    );
    expect(milestone.health).toBe('at_risk');
    expect(milestone.riskReasons[0]).toMatch(
      /^Forecast \d+ working days? late, on \d{1,2} [A-Z][a-z]{2}/,
    );
  });

  it('agrees with the risk cards on every commitment they say is late', async () => {
    const [detail, risks] = await Promise.all([
      owner.get(`/v1/projects/${projectId}`).expect(200),
      owner.get(`/v1/projects/${projectId}/risks`).expect(200),
    ]);
    const late: Commitment[] = risks.body.cards
      .flatMap(
        (card: { commitment: Commitment; impact: Commitment; alsoAffects: Commitment[] }) => [
          { ...card.commitment, slipWorkingDays: card.impact.slipWorkingDays },
          ...card.alsoAffects,
        ],
      )
      .filter((item: Commitment) => item.slipWorkingDays > 0);
    expect(late.map((item) => item.id)).toContain(chosen.milestone);
    for (const item of late) {
      if (item.kind === 'delivery') {
        expect(detail.body.health.status).toBe('off_track');
        continue;
      }
      const milestone = detail.body.milestones.find((row: { id: string }) => row.id === item.id);
      expect(['at_risk', 'missed']).toContain(milestone.health);
    }
    // One forecast: the header's forecast end is the delivery card's forecast date.
    expect(detail.body.health.forecastEndDate).toBe(risks.body.delivery.forecastDate);
  });

  it('lists the project with the same health in the project list', async () => {
    const [detail, list] = await Promise.all([
      owner.get(`/v1/projects/${projectId}`).expect(200),
      owner.get('/v1/projects?sort=createdAt&direction=desc&limit=20').expect(200),
    ]);
    const listed = list.body.items.find((item: { id: string }) => item.id === projectId);
    expect(listed.health).toEqual(detail.body.health);
  });
});
