import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

interface TeamBody {
  id: string;
  name: string;
  lead: { id: string } | null;
  memberCount: number;
  archivedAt: string | null;
  version: number;
}

let testApp: TestApp;
let admin: ReturnType<typeof client>;
let employee: ReturnType<typeof client>;
const stamp = Date.now();
const name = `Procurement ${stamp}`;
const createdTeamIds: string[] = [];
let employeeId: string;
let employeeTeamId: string | null = null;

async function personVersion(userId: string): Promise<number> {
  const response = await admin.get(`/v1/people/${userId}`).expect(200);
  return (response.body as { version: number }).version;
}

async function moveEmployee(teamId: string | null, status = 200) {
  const version = await personVersion(employeeId);
  await admin.patch(`/v1/people/${employeeId}`, { teamId, version }).expect(status);
}

beforeAll(async () => {
  testApp = await createTestApp();
  admin = client(testApp, await signInAs(testApp, PEOPLE.administrator));
  employee = client(testApp, await signInAs(testApp, PEOPLE.employee));
  employeeId = await userIdOf(testApp, PEOPLE.employee);
  const response = await admin.get(`/v1/people/${employeeId}`).expect(200);
  employeeTeamId = (response.body as { team: { id: string } | null }).team?.id ?? null;
});

afterAll(async () => {
  await moveEmployee(employeeTeamId);
  const pool = testApp.database.pool;
  for (const id of createdTeamIds) await pool.query('DELETE FROM teams WHERE id = $1', [id]);
  await testApp.close();
});

describe('team permissions', () => {
  it('answers 403 to people without users.manage', async () => {
    await employee.post('/v1/teams', { name: `Sneaky ${stamp}` }).expect(403);
    const teams = await admin.get('/v1/teams').expect(200);
    const [first] = teams.body as TeamBody[];
    if (!first) throw new Error('The seed creates teams.');
    await employee.patch(`/v1/teams/${first.id}`, { name: 'Renamed', version: 1 }).expect(403);
    await employee.post(`/v1/teams/${first.id}/archive`, { version: first.version }).expect(403);
  });
});

describe('team administration', () => {
  it('creates, renames, archives and restores a team, with audit rows', async () => {
    const leadId = await userIdOf(testApp, PEOPLE.teamLead);
    const created = await admin
      .post('/v1/teams', {
        name: `  ${name} `,
        description: 'Vendors and orders',
        leadUserId: leadId,
      })
      .expect(201);
    const team = created.body as TeamBody;
    createdTeamIds.push(team.id);
    expect(team).toMatchObject({ name, lead: { id: leadId }, memberCount: 0, archivedAt: null });

    await admin.post('/v1/teams', { name: name.toUpperCase() }).expect(409);

    const renamed = await admin
      .patch(`/v1/teams/${team.id}`, { name: `${name} and sourcing`, version: team.version })
      .expect(200);
    const afterRename = renamed.body as TeamBody;
    expect(afterRename).toMatchObject({ name: `${name} and sourcing`, version: 2 });
    await admin.patch(`/v1/teams/${team.id}`, { name: 'Stale', version: 1 }).expect(409);

    // Someone on the team blocks archiving.
    await moveEmployee(team.id);
    const blocked = await admin
      .post(`/v1/teams/${team.id}/archive`, { version: afterRename.version })
      .expect(422);
    expect(JSON.stringify(blocked.body)).toContain('1 person');

    await moveEmployee(null);
    const archived = await admin
      .post(`/v1/teams/${team.id}/archive`, { version: afterRename.version })
      .expect(200);
    const archivedTeam = archived.body as TeamBody;
    expect(archivedTeam.archivedAt).not.toBeNull();

    const active = (await admin.get('/v1/teams').expect(200)).body as TeamBody[];
    expect(active.some((item) => item.id === team.id)).toBe(false);
    const all = (await admin.get('/v1/teams?status=all').expect(200)).body as TeamBody[];
    expect(all.some((item) => item.id === team.id)).toBe(true);
    await moveEmployee(team.id, 400);

    const restored = await admin
      .post(`/v1/teams/${team.id}/restore`, { version: archivedTeam.version })
      .expect(200);
    expect((restored.body as TeamBody).archivedAt).toBeNull();

    const audits = await testApp.database.pool.query(
      "SELECT action FROM audit_log WHERE entity_type = 'team' AND entity_id = $1 ORDER BY created_at",
      [team.id],
    );
    expect(audits.rows.map((row: { action: string }) => row.action)).toEqual([
      'team.created',
      'team.updated',
      'team.archived',
      'team.restored',
    ]);
  });
});
