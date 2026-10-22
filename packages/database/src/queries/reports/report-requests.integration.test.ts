import { randomUUID } from 'node:crypto';
import { planReport } from '@lintel/application';
import { type Actor, DEFAULT_ROLE_CAPABILITIES, isWorkingDay } from '@lintel/domain';
import { eachCalendarDate, toCalendarDate } from '@lintel/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DatabaseConnection } from '../../client';
import { SettingsRepository } from '../../repositories/settings.repository';
import * as t from '../../schema';
import { loadApprovalsReport } from './approvals-report.query';
import { loadStudioStartDate } from './studio-start.query';
import { loadWorkloadReport } from './workload-report.query';

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const at = (iso: string) => new Date(iso);
// A month long ago, so nothing else in the test database falls inside it.
const range = { from: '2024-05-01', to: '2024-05-31' };
const sources = { timeZone: 'Asia/Kolkata', now: new Date(), audience: null };
const today = toCalendarDate('2026-10-21');

describe.skipIf(!url)('report periods and task requests (PostgreSQL)', () => {
  let connection: DatabaseConnection;
  let owner: Actor;
  const ids = { owner: '', pm: '', designer: '', project: '' };

  async function personByPhone(phone: string): Promise<string> {
    const [row] = await connection.db.select().from(t.users).where(eq(t.users.phoneE164, phone));
    if (!row) throw new Error('Seed the database before running integration tests.');
    return row.id;
  }

  beforeAll(async () => {
    connection = createDatabaseConnection(url ?? '', { max: 2 });
    const db = connection.db;
    ids.owner = await personByPhone('+919000000001');
    ids.pm = await personByPhone('+919000000003');
    ids.designer = await personByPhone('+919000000006');
    owner = {
      userId: ids.owner,
      role: 'owner',
      capabilities: new Set(DEFAULT_ROLE_CAPABILITIES.owner),
    };
    const [project] = await db
      .insert(t.projects)
      .values({
        reference: `REQ-${randomUUID().slice(0, 8)}`,
        name: 'Request report fixture',
        clientName: 'Fixture client (fictional)',
        projectType: 'residential_interior',
        ownerUserId: ids.owner,
        managerUserId: ids.pm,
        plannedStartDate: '2024-05-01',
        plannedEndDate: '2024-06-30',
        baselineEndDate: '2024-06-30',
        createdByUserId: ids.owner,
      })
      .returning();
    if (!project) throw new Error('fixture project');
    ids.project = project.id;
    await db.insert(t.projectMembers).values([
      { projectId: project.id, userId: ids.pm, projectRole: 'manager' },
      { projectId: project.id, userId: ids.designer, projectRole: 'designer' },
    ]);
    const tasks = await db
      .insert(t.tasks)
      .values(
        [1, 2, 3].map((number) => ({
          projectId: project.id,
          number,
          title: `Request fixture ${number}`,
          ownerUserId: ids.designer,
          dueDate: '2024-05-20',
        })),
      )
      .returning();
    const [one, two, three] = tasks;
    if (!one || !two || !three) throw new Error('fixture tasks');
    const ask = { projectId: project.id, requestedByUserId: ids.designer, reason: 'Fixture' };
    await db.insert(t.taskDateChangeRequests).values([
      // Accepted after 5 hours, declined after 3, one still open, one withdrawn (not a fact).
      {
        ...ask,
        taskId: one.id,
        proposedDueDate: '2024-05-22',
        status: 'accepted',
        createdAt: at('2024-05-06T04:00:00Z'),
        decidedAt: at('2024-05-06T09:00:00Z'),
        decidedByUserId: ids.pm,
      },
      {
        ...ask,
        taskId: two.id,
        proposedDueDate: '2024-05-23',
        status: 'declined',
        createdAt: at('2024-05-07T04:00:00Z'),
        decidedAt: at('2024-05-07T07:00:00Z'),
        decidedByUserId: ids.pm,
      },
      { ...ask, taskId: three.id, proposedDueDate: '2024-05-24', status: 'open' },
      {
        ...ask,
        taskId: one.id,
        proposedDueDate: '2024-05-25',
        status: 'withdrawn',
        createdAt: at('2024-05-08T04:00:00Z'),
      },
    ]);
    await db.insert(t.taskReassignmentRequests).values({
      ...ask,
      taskId: two.id,
      status: 'accepted',
      createdAt: at('2024-05-09T04:00:00Z'),
      decidedAt: at('2024-05-09T12:00:00Z'),
      decidedByUserId: ids.pm,
      newOwnerUserId: ids.pm,
    });
  });

  afterAll(async () => {
    await connection.db.delete(t.projects).where(eq(t.projects.id, ids.project));
    await connection.close();
  });

  it('counts new-date and handover requests in the approvals turnaround', async () => {
    const plan = planReport(owner, { ...range, projectId: ids.project }, today, false);
    const approvals = await loadApprovalsReport(connection.db, plan, sources);
    const kind = (name: string) => approvals.kinds.find((row) => row.kind === name);
    expect(kind('date_change')).toMatchObject({
      decided: 2,
      medianHours: 4,
      slowestHours: 5,
      waiting: 1,
    });
    expect(kind('reassignment')).toMatchObject({ decided: 1, medianHours: 8, waiting: 0 });
    expect(approvals.byDecider).toContainEqual(
      expect.objectContaining({ kind: 'date_change', decided: 2, decider: expect.anything() }),
    );
    expect(approvals.slowest[0]).toMatchObject({ kind: 'reassignment', hours: 8 });
  });

  it('starts reports no earlier than the studio did', async () => {
    const studioStart = await loadStudioStartDate(connection.db, sources.timeZone);
    expect(studioStart !== null && studioStart <= '2024-05-01').toBe(true);
    const started = toCalendarDate('2024-05-15');
    const plan = planReport(owner, { ...range, projectId: ids.project }, today, false, started);
    expect(plan.range).toEqual({ start: '2024-05-15', end: '2024-05-31' });
    expect(plan.periods[0]?.start).toBe('2024-05-15');
    const report = await loadWorkloadReport(connection.db, plan, {
      ...sources,
      workTrackingEnabled: true,
    });
    expect(report.studioStartDate).toBe('2024-05-15');
    const calendar = (
      await new SettingsRepository(connection.db).calendarsForUsers([ids.designer])
    ).get(ids.designer);
    const [person] = await connection.db.select().from(t.users).where(eq(t.users.id, ids.designer));
    if (!calendar) throw new Error('designer calendar');
    const workingDays = eachCalendarDate(started, toCalendarDate(range.to)).filter((date) =>
      isWorkingDay(calendar, date),
    ).length;
    const perDay = (calendar.workingMinutesPerDay * (person?.capacityPercent ?? 100)) / 100;
    const designer = report.byPerson.find((row) => row.user.id === ids.designer);
    expect(designer?.availableMinutes).toBe(Math.round(workingDays * perDay));
  });
});
