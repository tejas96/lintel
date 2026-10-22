import {
  Notifier,
  type OperationsDependencies,
  type RequestContext,
  TaskStructureCommands,
  TaskViewerQuery,
  TransitionTaskCommand,
} from '@lintel/application';
import { DEFAULT_ROLE_CAPABILITIES, type Role } from '@lintel/domain';
import { calendarDateInTimeZone, systemClock } from '@lintel/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DatabaseConnection } from '../src/client';
import { activityEvents, auditLog, outboxEvents, taskChecklistItems, tasks } from '../src/schema';
import { DrizzleUnitOfWork } from '../src/unit-of-work';
import { createTaskFixture, removeTaskFixture, type TaskFixture } from './fixtures/task-fixture';

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe.skipIf(!url)('task transitions against PostgreSQL', () => {
  let connection: DatabaseConnection;
  let fixture: TaskFixture;
  let deps: OperationsDependencies;
  const context = (key: string, role: Role): RequestContext => ({
    actor: {
      userId: fixture.people[key] ?? '',
      role,
      capabilities: new Set(DEFAULT_ROLE_CAPABILITIES[role]),
    },
    sessionId: 'integration',
    requestId: `integration-${key}`,
  });

  beforeAll(async () => {
    connection = createDatabaseConnection(url ?? '', { max: 4 });
    const today = calendarDateInTimeZone(new Date(), 'Asia/Kolkata');
    fixture = await createTaskFixture(connection.db, today);
    const uow = new DrizzleUnitOfWork(connection.db);
    deps = {
      uow,
      clock: systemClock,
      context: {
        today: async () => today,
        notifierFor: async (stores) =>
          new Notifier(stores.notifications, stores.records, systemClock, {
            timeZone: 'Asia/Kolkata',
            quietHoursStart: '21:00',
            quietHoursEnd: '08:00',
            smsConfigured: false,
          }),
      },
    };
  });

  afterAll(async () => {
    if (fixture) await removeTaskFixture(connection.db, fixture);
    await connection.close();
  });

  const taskRow = async (id: string) => {
    const [row] = await connection.db.select().from(tasks).where(eq(tasks.id, id));
    return row;
  };

  it('loads decision inputs and explains why a dependent task cannot start yet', async () => {
    const inputs = await deps.uow.stores.tasks.decisionInputs(fixture.tasks.moodboard);
    expect(inputs.prerequisites.map((item) => item.title)).toEqual(['Measure the site']);
    expect(inputs.deliverables).toEqual([
      { name: 'Moodboard PDF', isRequired: true, status: 'not_submitted', currentVersionNumber: 0 },
    ]);
    const state = await new TaskViewerQuery(deps.uow.stores).execute(
      context('designer1', 'employee').actor,
      fixture.tasks.moodboard,
    );
    expect(state.transitions.find((option) => option.to === 'in_progress')).toMatchObject({
      allowed: false,
      reasons: ['Waiting on: Measure the site.'],
    });
  });

  it('starts work with an optimistic version and writes activity and audit in one transaction', async () => {
    const command = new TransitionTaskCommand(deps);
    const owner = context('designer1', 'employee');
    const after = await command.execute(owner, fixture.tasks.measure, {
      to: 'in_progress',
      note: null,
      version: 1,
    });
    expect(after).toMatchObject({ status: 'in_progress', version: 2 });
    const row = await taskRow(fixture.tasks.measure);
    expect(row?.startedAt).not.toBeNull();
    expect(row?.acknowledgedAt).not.toBeNull();
    const activity = await connection.db
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.taskId, fixture.tasks.measure));
    expect(activity.map((entry) => entry.type)).toEqual(['task.status_changed']);
    const audit = await connection.db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, fixture.tasks.measure), eq(auditLog.entityType, 'task')));
    expect(audit[0]?.after).toMatchObject({ status: 'in_progress', version: 2 });
    await expect(
      command.execute(owner, fixture.tasks.measure, { to: 'ready', note: null, version: 1 }),
    ).rejects.toMatchObject({ code: 'STALE_VERSION' });
    expect((await taskRow(fixture.tasks.measure))?.status).toBe('in_progress');
  });

  it('refuses completion until the required checklist is done, then completes and emits the event', async () => {
    const command = new TransitionTaskCommand(deps);
    const owner = context('designer1', 'employee');
    await expect(
      command.execute(owner, fixture.tasks.measure, { to: 'done', note: null, version: 2 }),
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: '2 required checklist items are not done.',
    });
    const items = await connection.db
      .select()
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.taskId, fixture.tasks.measure));
    const structure = new TaskStructureCommands(deps);
    for (const item of items.filter((candidate) => candidate.isRequired)) {
      await structure.toggleChecklistItem(owner, item.id, true);
    }
    const done = await command.execute(owner, fixture.tasks.measure, {
      to: 'done',
      note: null,
      version: 2,
    });
    expect(done).toMatchObject({ status: 'done', completedByUserId: fixture.people.designer1 });
    const events = await connection.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.aggregateId, fixture.tasks.measure));
    expect(events.map((event) => event.eventType)).toContain('TaskCompleted');
    const state = await new TaskViewerQuery(deps.uow.stores).execute(
      owner.actor,
      fixture.tasks.moodboard,
    );
    expect(state.transitions.find((option) => option.to === 'in_progress')?.allowed).toBe(true);
  });

  it('hides tasks of other projects (404) and refuses non-participants (403)', async () => {
    const command = new TransitionTaskCommand(deps);
    await expect(
      command.execute(context('designer1', 'employee'), fixture.tasks.other, {
        to: 'in_progress',
        note: null,
        version: 1,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      command.execute(context('site', 'site_supervisor'), fixture.tasks.sourcing, {
        to: 'in_progress',
        note: null,
        version: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
