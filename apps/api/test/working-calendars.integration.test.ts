import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, nextMonday, userIdOf } from './support/journey-helpers';
import { createTestApp, PEOPLE, signInAs, type TestApp } from './support/test-app';

let testApp: TestApp;
let admin: ReturnType<typeof client>;
let adminToken: string;
const VISUALISER = '9000000008';
let calendarId: string | null = null;
let visualiserId: string;

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function remove(id: string) {
  return testApp.http
    .delete(`/v1/settings/calendars/${id}`)
    .set({ authorization: `Bearer ${adminToken}` });
}

async function setCalendar(id: string | null): Promise<void> {
  const person = await admin.get(`/v1/people/${visualiserId}`).expect(200);
  await admin
    .patch(`/v1/people/${visualiserId}`, { workingCalendarId: id, version: person.body.version })
    .expect(200);
}

beforeAll(async () => {
  testApp = await createTestApp();
  adminToken = await signInAs(testApp, PEOPLE.administrator);
  admin = client(testApp, adminToken);
  visualiserId = await userIdOf(testApp, VISUALISER);
});

afterAll(async () => {
  const pool = testApp.database.pool;
  await pool.query('UPDATE users SET working_calendar_id = NULL WHERE id = $1', [visualiserId]);
  if (calendarId) await pool.query('DELETE FROM working_calendars WHERE id = $1', [calendarId]);
  await testApp.close();
});

describe('working calendar permissions', () => {
  it('answers 403 to people who neither manage settings nor people', async () => {
    for (const number of [PEOPLE.employee, PEOPLE.teamLead]) {
      const person = client(testApp, await signInAs(testApp, number));
      await person.get('/v1/settings/calendars').expect(403);
      await person
        .post('/v1/settings/calendars', {
          name: 'Nope',
          workingWeekdays: [1],
          dayStartTime: '09:00',
          dayEndTime: '17:00',
          workingMinutesPerDay: 420,
        })
        .expect(403);
    }
  });
});

describe('working weeks', () => {
  it('assigns a person a four-day week that capacity then uses', async () => {
    const list = await admin.get('/v1/settings/calendars').expect(200);
    expect(list.body[0]).toMatchObject({ isDefault: true });
    expect(list.body[0].peopleCount).toBeGreaterThanOrEqual(10);

    const invalid = await admin.post('/v1/settings/calendars', {
      name: 'Backwards week',
      workingWeekdays: [1, 2],
      dayStartTime: '18:00',
      dayEndTime: '09:00',
      workingMinutesPerDay: 480,
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.details[0]).toMatchObject({ field: 'dayEndTime' });

    const created = await admin
      .post('/v1/settings/calendars', {
        name: `Four-day week ${Date.now()}`,
        workingWeekdays: [4, 3, 2, 1],
        dayStartTime: '08:00',
        dayEndTime: '18:00',
        workingMinutesPerDay: 540,
      })
      .expect(201);
    calendarId = created.body.id;
    expect(created.body).toMatchObject({ workingWeekdays: [1, 2, 3, 4], peopleCount: 0 });

    await setCalendar(created.body.id);
    const entry = await admin.get(`/v1/people/${visualiserId}`).expect(200);
    expect(entry.body.workingCalendarId).toBe(created.body.id);

    // A studio holiday applies to every working week, not just the studio's own.
    const monday = addDays(nextMonday(), 21);
    const holiday = await admin
      .post('/v1/settings/holidays', { date: addDays(monday, 1), name: 'Integration holiday' })
      .expect(201);
    const capacity = await admin
      .get(`/v1/capacity?from=${monday}&to=${addDays(monday, 6)}`)
      .expect(200);
    await testApp.http
      .delete(`/v1/settings/holidays/${holiday.body.id}`)
      .set({ authorization: `Bearer ${adminToken}` })
      .expect(204);
    const visualiser = capacity.body.people.find(
      (person: { user: { id: string } }) => person.user.id === visualiserId,
    );
    const workingDays = visualiser.days.filter(
      (day: { isWorkingDay: boolean }) => day.isWorkingDay,
    );
    expect(workingDays.map((day: { date: string }) => day.date)).toEqual(
      [0, 2, 3].map((offset) => addDays(monday, offset)),
    );
    expect(workingDays[0].availableMinutes).toBe(540);

    const inUse = await remove(created.body.id);
    expect(inUse.status).toBe(422);
    expect(inUse.body.message).toMatch(/1 person still follow/);

    const edited = await admin
      .patch(`/v1/settings/calendars/${created.body.id}`, {
        workingMinutesPerDay: 480,
        version: created.body.version,
      })
      .expect(200);
    expect(edited.body).toMatchObject({ workingMinutesPerDay: 480, peopleCount: 1 });
    await admin
      .patch(`/v1/settings/calendars/${created.body.id}`, {
        workingMinutesPerDay: 420,
        version: created.body.version,
      })
      .expect(409);

    await setCalendar(null);
    await remove(created.body.id).expect(204);
    calendarId = null;
  });

  it('never removes the studio week', async () => {
    const list = await admin.get('/v1/settings/calendars').expect(200);
    const response = await remove(list.body[0].id);
    expect(response.status).toBe(422);
  });
});
