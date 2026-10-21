import { planReport, type ReportPlan } from '@lintel/application';
import { type Actor, DEFAULT_ROLE_CAPABILITIES } from '@lintel/domain';
import { toCalendarDate } from '@lintel/shared';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedLearningFixture } from '../../../test/fixtures/learning-report-fixture';
import { createDatabaseConnection, type DatabaseConnection } from '../../client';
import * as t from '../../schema';
import { loadDelaysReport } from './delays-report.query';
import { loadEstimatesReport } from './estimates-report.query';
import { loadReworkReport } from './rework-report.query';

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
// Two ISO weeks long ago, so nothing else in the test database is decided inside them.
const range = { from: '2023-05-01', to: '2023-05-14' };
const sources = { timeZone: 'Asia/Kolkata', now: new Date() };

describe.skipIf(!url)('learning report read models (PostgreSQL)', () => {
  let connection: DatabaseConnection;
  let fixture: Awaited<ReturnType<typeof seedLearningFixture>>;
  let projectPlan: ReportPlan;
  let studioPlan: ReportPlan;

  beforeAll(async () => {
    connection = createDatabaseConnection(url ?? '', { max: 2 });
    fixture = await seedLearningFixture(connection.db);
    const owner: Actor = {
      userId: fixture.ids.owner,
      role: 'owner',
      capabilities: new Set(DEFAULT_ROLE_CAPABILITIES.owner),
    };
    const today = toCalendarDate('2026-10-21');
    projectPlan = planReport(owner, { ...range, projectId: fixture.ids.projectA }, today, false);
    studioPlan = planReport(owner, range, today, false);
  });

  afterAll(async () => {
    const db = connection.db;
    await db
      .delete(t.projects)
      .where(inArray(t.projects.id, [fixture.ids.projectA, fixture.ids.projectB]));
    await db.delete(t.files).where(eq(t.files.id, fixture.ids.file));
    await connection.close();
  });

  it('measures estimated against logged effort of finished tasks', async () => {
    const report = await loadEstimatesReport(connection.db, projectPlan, {
      ...sources,
      workTrackingEnabled: true,
    });
    expect(report.totals).toEqual({
      measured: 3,
      estimatedMinutes: 360,
      loggedMinutes: 280,
      effortRatio: 0.778,
      within: 1,
      over: 1,
      under: 1,
      withinRate: 0.333,
      medianRatio: 0.9,
      notMeasured: 1,
      withoutEstimate: 1,
    });
    expect(report.byPeriod.map((period) => period.measured)).toEqual([2, 1]);
    const templated = report.byTaskType.find((row) => row.key !== null);
    expect(templated).toMatchObject({
      name: fixture.template.taskTitle,
      template: fixture.template.name,
      measured: 2,
      within: 1,
      over: 1,
    });
    expect(report.byTaskType.at(-1)).toMatchObject({
      key: null,
      name: 'Added by hand',
      measured: 1,
      notMeasured: 1,
      withoutEstimate: 1,
    });
    expect(report.byTemplate).toEqual([
      expect.objectContaining({
        template: { id: fixture.template.id, name: fixture.template.name },
      }),
    ]);
    const person = (id: string) => report.byPerson.find((row) => row.user.id === id);
    expect(person(fixture.ids.designer)?.measured).toBe(2);
    expect(person(fixture.ids.pm)).toMatchObject({ measured: 1, under: 1 });
    expect(report.workTrackingEnabled).toBe(true);
  });

  it('counts versions sent back out of those reviewed', async () => {
    const report = await loadReworkReport(connection.db, projectPlan, sources);
    expect(report.totals).toEqual({
      reviewed: 4,
      approved: 2,
      changesRequested: 1,
      rejected: 1,
      sentBack: 2,
      reworkRate: 0.5,
    });
    expect(report.byPeriod.map((period) => period.reviewed)).toEqual([3, 1]);
    expect(report.mostSentBack).toEqual([
      expect.objectContaining({
        kind: 'task',
        recordId: fixture.ids.reviewedTask,
        sentBack: 2,
        reviewed: 3,
      }),
    ]);
    expect(report.byPerson).toEqual([
      expect.objectContaining({ reviewed: 4, sentBack: 2, reworkRate: 0.5 }),
    ]);
    expect(report.byProject[0]?.project.id).toBe(fixture.ids.projectA);
  });

  it('measures approval waits by kind and finds the slowest', async () => {
    const report = await loadDelaysReport(connection.db, projectPlan, sources);
    const kind = (name: string) => report.kinds.find((row) => row.kind === name);
    expect(kind('internal_review')).toMatchObject({
      count: 4,
      delayed: 1,
      medianHours: 24,
      slowestHours: 72,
      waitingNow: 1,
    });
    expect(kind('client_signoff')).toMatchObject({ count: 1, delayed: 1, slowestHours: 120 });
    expect(report.slowest[0]).toMatchObject({ kind: 'client_signoff', hours: 120, delayed: true });
    expect(report.slowest[1]).toMatchObject({ kind: 'internal_review', hours: 72 });
  });

  it('groups clients by trimmed, case-insensitive name and flags recurring delays', async () => {
    const report = await loadDelaysReport(connection.db, studioPlan, sources);
    const client = report.byClient.find((row) => row.client === fixture.clientName);
    expect(client).toMatchObject({ projects: 2, recurring: true, total: { delayed: 3 } });
    const projectB = report.byProject.find((row) => row.project.id === fixture.ids.projectB);
    expect(projectB?.recurring).toBe(false);
    expect(projectB?.kinds).toEqual([
      expect.objectContaining({ kind: 'client_signoff', count: 1, slowestHours: 0, waitingNow: 1 }),
      expect.objectContaining({ kind: 'client_wait', count: 1, delayed: 1, waitingNow: 1 }),
    ]);
  });
});
