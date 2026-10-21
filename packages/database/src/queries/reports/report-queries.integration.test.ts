import { randomUUID } from 'node:crypto';
import { planReport, type ReportPlan } from '@lintel/application';
import { type Actor, DEFAULT_ROLE_CAPABILITIES, isWorkingDay } from '@lintel/domain';
import { eachCalendarDate, toCalendarDate } from '@lintel/shared';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DatabaseConnection } from '../../client';
import { SettingsRepository } from '../../repositories/settings.repository';
import * as t from '../../schema';
import { loadApprovalsReport } from './approvals-report.query';
import { loadDeliveryReport } from './delivery-report.query';
import { loadLeaveReport } from './leave-report.query';
import { loadWorkloadReport } from './workload-report.query';

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const at = (iso: string) => new Date(iso);
// Two ISO weeks long ago, so nothing else in the test database falls inside them.
const range = { from: '2024-03-04', to: '2024-03-17' };
const sources = { timeZone: 'Asia/Kolkata', now: new Date() };

describe.skipIf(!url)('report read models (PostgreSQL)', () => {
  let connection: DatabaseConnection;
  let plan: ReportPlan;
  const ids = { owner: '', pm: '', designer: '', project: '', file: '', leave: [] as string[] };

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
    const [project] = await db
      .insert(t.projects)
      .values({
        reference: `RPT-${randomUUID().slice(0, 8)}`,
        name: 'Report fixture',
        clientName: 'Fixture client (fictional)',
        projectType: 'residential_interior',
        ownerUserId: ids.owner,
        managerUserId: ids.pm,
        plannedStartDate: '2024-03-01',
        plannedEndDate: '2024-04-30',
        baselineEndDate: '2024-04-30',
        createdByUserId: ids.owner,
      })
      .returning();
    if (!project) throw new Error('fixture project');
    ids.project = project.id;
    await db.insert(t.projectMembers).values([
      { projectId: project.id, userId: ids.pm, projectRole: 'manager' },
      { projectId: project.id, userId: ids.designer, projectRole: 'designer' },
    ]);
    const task = (number: number, values: Partial<typeof t.tasks.$inferInsert>) => ({
      projectId: project.id,
      number,
      title: `Fixture task ${number}`,
      ownerUserId: ids.designer,
      ...values,
    });
    const tasks = await db
      .insert(t.tasks)
      .values([
        // On time: due and finished on 6 March (17:30 in India).
        task(1, { status: 'done', dueDate: '2024-03-06', completedAt: at('2024-03-06T12:00:00Z') }),
        // Two days late; 240 minutes over Monday–Wednesday.
        task(2, {
          status: 'done',
          estimateMinutes: 240,
          plannedStartDate: '2024-03-04',
          dueDate: '2024-03-06',
          completedAt: at('2024-03-08T06:00:00Z'),
        }),
        // Still open, due 12 March: open overdue; 600 minutes over Monday and Tuesday.
        task(3, {
          status: 'in_progress',
          estimateMinutes: 600,
          plannedStartDate: '2024-03-11',
          dueDate: '2024-03-12',
        }),
        task(4, { status: 'cancelled', dueDate: '2024-03-07', estimateMinutes: 999 }),
        task(5, { status: 'done', completedAt: at('2024-03-07T06:00:00Z') }),
      ])
      .returning();
    const first = tasks.find((row) => row.number === 1);
    if (!first) throw new Error('fixture tasks');
    await db.insert(t.milestones).values({
      projectId: project.id,
      name: 'Fixture milestone',
      dueDate: '2024-03-09',
      baselineDueDate: '2024-03-09',
      status: 'completed',
      completedAt: at('2024-03-10T06:00:00Z'),
    });
    await db.insert(t.workSessions).values({
      taskId: first.id,
      userId: ids.designer,
      startedAt: at('2024-03-06T04:30:00Z'),
      endedAt: at('2024-03-06T06:30:00Z'),
    });
    const [file] = await db
      .insert(t.files)
      .values({
        storageKey: `fixture/${randomUUID()}.pdf`,
        originalName: 'fixture.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1,
        checksumSha256: '0'.repeat(64),
        projectId: project.id,
        uploadedByUserId: ids.designer,
      })
      .returning();
    if (!file) throw new Error('fixture file');
    ids.file = file.id;
    const [deliverable] = await db
      .insert(t.deliverables)
      .values({
        projectId: project.id,
        taskId: first.id,
        name: 'Fixture drawing',
        status: 'approved',
        currentVersionNumber: 1,
      })
      .returning();
    if (!deliverable) throw new Error('fixture deliverable');
    await db.insert(t.deliverableVersions).values({
      deliverableId: deliverable.id,
      versionNumber: 1,
      fileId: file.id,
      submittedByUserId: ids.designer,
      submittedAt: at('2024-03-06T04:30:00Z'),
      decision: 'approved',
      reviewedByUserId: ids.pm,
      reviewedAt: at('2024-03-06T14:30:00Z'),
    });
    await db.insert(t.scopeChangeRequests).values({
      projectId: project.id,
      title: 'Fixture scope change',
      description: 'Fixture',
      status: 'approved',
      requestedByUserId: ids.designer,
      decidedByUserId: ids.owner,
      createdAt: at('2024-03-05T04:30:00Z'),
      decidedAt: at('2024-03-05T10:30:00Z'),
    });
    const [casual] = await db.select().from(t.leaveTypes).where(eq(t.leaveTypes.code, 'casual'));
    if (!casual) throw new Error('Seed the leave types first.');
    const leave = await db
      .insert(t.leaveRequests)
      .values({
        userId: ids.designer,
        leaveTypeId: casual.id,
        startDate: '2024-03-14',
        endDate: '2024-03-14',
        halfDayUnits: 2,
        status: 'approved',
        createdAt: at('2024-03-04T04:30:00Z'),
        decidedAt: at('2024-03-04T08:30:00Z'),
      })
      .returning();
    ids.leave = leave.map((row) => row.id);
    const owner: Actor = {
      userId: ids.owner,
      role: 'owner',
      capabilities: new Set(DEFAULT_ROLE_CAPABILITIES.owner),
    };
    plan = planReport(
      owner,
      { ...range, projectId: project.id },
      toCalendarDate('2026-10-21'),
      false,
    );
  });

  afterAll(async () => {
    const db = connection.db;
    await db.delete(t.leaveRequests).where(inArray(t.leaveRequests.id, ids.leave));
    await db.delete(t.projects).where(eq(t.projects.id, ids.project));
    await db.delete(t.files).where(eq(t.files.id, ids.file));
    await connection.close();
  });

  it('counts on-time, late and open overdue work by period and person', async () => {
    const report = await loadDeliveryReport(connection.db, plan, sources);
    expect(report.totals.tasks).toEqual({
      onTime: 1,
      late: 1,
      openOverdue: 1,
      onTimeRate: 0.5,
      averageDaysLate: 2,
    });
    expect(report.totals.milestones).toMatchObject({ onTime: 0, late: 1, averageDaysLate: 1 });
    expect(report.byPeriod.map((period) => period.tasks.openOverdue)).toEqual([0, 1]);
    expect(report.byPeriod[0]?.tasks).toMatchObject({ onTime: 1, late: 1 });
    expect(report.byPerson).toHaveLength(1);
    expect(report.byPerson[0]?.user.id).toBe(ids.designer);
  });

  it('spreads planned work, removes leave from available time and adds logged time', async () => {
    const report = await loadWorkloadReport(connection.db, plan, {
      ...sources,
      workTrackingEnabled: true,
    });
    const designer = report.byPerson.find((row) => row.user.id === ids.designer);
    const calendar = (
      await new SettingsRepository(connection.db).calendarsForUsers([ids.designer])
    ).get(ids.designer);
    if (!designer || !calendar) throw new Error('designer row');
    const [person] = await connection.db.select().from(t.users).where(eq(t.users.id, ids.designer));
    const workingDays = eachCalendarDate(
      toCalendarDate(range.from),
      toCalendarDate(range.to),
    ).filter((date) => isWorkingDay(calendar, date)).length;
    const perDay = (calendar.workingMinutesPerDay * (person?.capacityPercent ?? 100)) / 100;
    // 120 (no estimate, on its due date) + 240 + 600; the cancelled task never counts.
    expect(designer).toMatchObject({
      plannedMinutes: 960,
      loggedMinutes: 120,
      leaveDays: 1,
      scheduledTasks: 3,
      tasksWithoutEstimate: 1,
      availableMinutes: Math.round((workingDays - 1) * perDay),
    });
    expect(report.coversAllProjects).toBe(false);
  });

  it('counts approved leave days and decision turnaround', async () => {
    const leave = await loadLeaveReport(connection.db, plan, { ...sources, audience: null });
    expect(leave.byPerson.find((row) => row.user.id === ids.designer)).toMatchObject({
      days: 1,
      requests: 1,
    });
    const approvals = await loadApprovalsReport(connection.db, plan, {
      ...sources,
      audience: null,
    });
    const kind = (name: string) => approvals.kinds.find((row) => row.kind === name);
    expect(kind('deliverable_review')).toMatchObject({ decided: 1, medianHours: 10 });
    expect(kind('scope_change')).toMatchObject({ decided: 1, medianHours: 6 });
    expect(kind('leave_decision')).toMatchObject({ decided: 1, medianHours: 4 });
    expect(approvals.slowest[0]).toMatchObject({ kind: 'deliverable_review', hours: 10 });
  });
});
