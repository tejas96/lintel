import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, nextMonday, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

let testApp: TestApp;
let admin: ReturnType<typeof client>;
let lead: ReturnType<typeof client>;
let designer: ReturnType<typeof client>;
const SECOND_DESIGNER = '9000000007';
const name = `Study leave ${Date.now()}`;
let createdTypeId: string | null = null;

function weeksAhead(weeks: number): { start: string; end: string } {
  const monday = new Date(`${nextMonday()}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() + weeks * 7);
  const tuesday = new Date(monday);
  tuesday.setUTCDate(tuesday.getUTCDate() + 1);
  return { start: monday.toISOString().slice(0, 10), end: tuesday.toISOString().slice(0, 10) };
}

beforeAll(async () => {
  testApp = await createTestApp();
  admin = client(testApp, await signInAs(testApp, PEOPLE.administrator));
  lead = client(testApp, await signInAs(testApp, PEOPLE.teamLead));
  designer = client(testApp, await signInAs(testApp, SECOND_DESIGNER));
});

afterAll(async () => {
  const pool = testApp.database.pool;
  if (createdTypeId) {
    await pool.query('DELETE FROM leave_requests WHERE leave_type_id = $1', [createdTypeId]);
    await pool.query('DELETE FROM leave_types WHERE id = $1', [createdTypeId]);
  }
  await admin.put('/v1/leave/policies/rules', { secondApprovalAboveHalfDays: 10 });
  await testApp.close();
});

describe('leave policy permissions', () => {
  it('answers 403 to people without leave.manage_policies', async () => {
    for (const person of [designer, lead]) {
      await person.get('/v1/leave/policies').expect(403);
      await person
        .post('/v1/leave/policies/types', {
          name: 'Sneaky leave',
          description: null,
          requiresReason: false,
          allowsHalfDay: true,
          minimumNoticeDays: 0,
          annualAllowanceHalfDays: null,
          colorIndex: 0,
        })
        .expect(403);
      await person.put('/v1/leave/policies/rules', { secondApprovalAboveHalfDays: 2 }).expect(403);
    }
  });
});

describe('leave type administration', () => {
  it('creates, edits and retires a type without breaking requests already made', async () => {
    const created = await admin
      .post('/v1/leave/policies/types', {
        name,
        description: 'Exams and courses',
        requiresReason: true,
        allowsHalfDay: false,
        minimumNoticeDays: 5,
        annualAllowanceHalfDays: 10,
        colorIndex: 2,
      })
      .expect(201);
    createdTypeId = created.body.id;
    expect(created.body).toMatchObject({ isActive: true, version: 1, requestCount: 0 });
    const invalid = await admin.patch(`/v1/leave/policies/types/${created.body.id}`, {
      annualAllowanceHalfDays: 7,
      version: 1,
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.details[0].field).toBe('annualAllowanceHalfDays');

    const offered = await designer.get('/v1/leave/types').expect(200);
    expect(offered.body.some((type: { id: string }) => type.id === created.body.id)).toBe(true);
    const dates = weeksAhead(9);
    const requested = await designer
      .post('/v1/leave/requests', {
        leaveTypeId: created.body.id,
        startDate: dates.start,
        endDate: dates.end,
        dayPortion: 'full',
        reason: 'Final exams',
        handovers: [],
      })
      .expect(201);

    const policies = await admin.get('/v1/leave/policies').expect(200);
    const listed = policies.body.types.find((type: { id: string }) => type.id === created.body.id);
    expect(listed).toMatchObject({ requestCount: 1, openRequestCount: 1 });
    const retired = await admin
      .post(`/v1/leave/policies/types/${created.body.id}/retire`, { version: listed.version })
      .expect(200);
    expect(retired.body.isActive).toBe(false);
    await admin
      .post(`/v1/leave/policies/types/${created.body.id}/retire`, { version: listed.version })
      .expect(409);

    const stillOffered = await designer.get('/v1/leave/types').expect(200);
    expect(stillOffered.body.some((type: { id: string }) => type.id === created.body.id)).toBe(
      false,
    );
    const later = weeksAhead(11);
    const refused = await designer.post('/v1/leave/requests', {
      leaveTypeId: created.body.id,
      startDate: later.start,
      endDate: later.end,
      dayPortion: 'full',
      reason: 'Another exam',
      handovers: [],
    });
    expect(refused.status).toBe(400);
    expect(refused.body.message).toBe('This leave type is no longer offered.');

    const detail = await lead.get(`/v1/leave/requests/${requested.body.id}`).expect(200);
    expect(detail.body.impact.blockingProblems).toEqual([]);
    const decided = await lead
      .post(`/v1/leave/requests/${requested.body.id}/decision`, {
        decision: 'approve',
        note: null,
        version: detail.body.version,
      })
      .expect(200);
    expect(decided.body.status).toBe('approved');
    expect(decided.body.leaveType.id).toBe(created.body.id);

    await admin
      .post(`/v1/leave/policies/types/${created.body.id}/reactivate`, {
        version: retired.body.version,
      })
      .expect(200);
  });

  it('changes the second-approval threshold used for new requests', async () => {
    const saved = await admin
      .put('/v1/leave/policies/rules', { secondApprovalAboveHalfDays: 1 })
      .expect(200);
    expect(saved.body).toEqual({ secondApprovalAboveHalfDays: 1 });
    const types = await designer.get('/v1/leave/types').expect(200);
    const casual = types.body.find((type: { code: string }) => type.code === 'casual');
    // Any full working day (2 half-days) is now longer than the threshold.
    const dates = weeksAhead(15);
    const preview = await designer
      .post('/v1/leave/preview', {
        leaveTypeId: casual.id,
        startDate: dates.start,
        endDate: dates.end,
        dayPortion: 'full',
        userId: null,
        reason: null,
      })
      .expect(200);
    expect(preview.body.approvalLevels).toBe(2);
    await admin.put('/v1/leave/policies/rules', { secondApprovalAboveHalfDays: 0 }).expect(400);
    const organization = await admin.get('/v1/settings/organization').expect(200);
    expect(organization.body.leaveSecondApprovalAboveHalfDays).toBe(1);
    expect(await userIdOf(testApp, SECOND_DESIGNER)).toBeTruthy();
  });
});
