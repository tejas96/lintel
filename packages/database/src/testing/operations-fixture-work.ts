import type { DatabaseExecutor } from '../client';
import {
  taskBlockers,
  taskChecklistItems,
  taskCollaborators,
  taskScheduleChanges,
  tasks,
} from '../schema';
import type { FixturePeople, FixtureProjects } from './operations-fixture';
import { seedReviewsAndDecisions } from './operations-fixture-reviews';

const at = (value: string) => new Date(`${value}+05:30`);
type TaskValues = Omit<typeof tasks.$inferInsert, 'number'>;

function personOf(map: FixturePeople, key: string): string {
  const id = map[key];
  if (!id) throw new Error(`Unknown fixture person ${key}`);
  return id;
}

/** Inserts tasks with per-project numbers; returns their IDs in order. */
async function insertTasks(db: DatabaseExecutor, values: readonly TaskValues[]): Promise<string[]> {
  const counters = new Map<string, number>();
  const rows = values.map((value) => {
    const number = (counters.get(value.projectId) ?? 0) + 1;
    counters.set(value.projectId, number);
    return { requiresAcknowledgement: false, ...value, number };
  });
  const inserted = await db.insert(tasks).values(rows).returning({ id: tasks.id });
  return inserted.map((row) => row.id);
}

function pick(ids: readonly string[], index: number): string {
  const id = ids[index];
  if (!id) throw new Error(`Fixture task ${index} is missing.`);
  return id;
}

export async function seedFixtureWork(
  db: DatabaseExecutor,
  map: FixturePeople,
  fixture: FixtureProjects,
): Promise<void> {
  const p = (key: string) => personOf(map, key);
  const { saska, koregaon, baner } = fixture;
  const done = (completed: string, due: string, extra: Partial<TaskValues> = {}) => ({
    status: 'done' as const,
    completedAt: at(completed),
    dueDate: due,
    baselineDueDate: due,
    estimateMinutes: 240,
    actualMinutes: 240,
    ...extra,
  });
  const ids = await insertTasks(db, [
    // 0–3: Ananya's open work around her leave (milestone, due dates, a draft and a blocked task).
    {
      projectId: saska,
      title: 'Living room moodboard',
      status: 'in_progress',
      priority: 'high',
      ownerUserId: p('designer1'),
      reviewerUserId: p('lead'),
      plannedStartDate: '2026-10-20',
      dueDate: '2026-10-29',
      estimateMinutes: 600,
      actualMinutes: 120,
      milestoneId: fixture.designFreeze,
    },
    {
      projectId: saska,
      title: 'Kitchen joinery drawings',
      status: 'ready',
      ownerUserId: p('designer1'),
      plannedStartDate: '2026-10-26',
      dueDate: '2026-11-03',
      estimateMinutes: 480,
    },
    {
      projectId: koregaon,
      title: 'Reception lighting layout',
      status: 'draft',
      ownerUserId: p('designer1'),
      dueDate: '2026-11-06',
    },
    {
      projectId: saska,
      title: 'Bedroom wardrobe elevations',
      status: 'blocked',
      ownerUserId: p('designer1'),
      plannedStartDate: '2026-10-12',
      dueDate: '2026-10-24',
      estimateMinutes: 360,
    },
    // 4–8: the rest of the studio's open work.
    {
      projectId: saska,
      title: 'Bathroom tile schedule',
      status: 'in_progress',
      priority: 'urgent',
      ownerUserId: p('designer2'),
      dueDate: '2026-10-21',
      estimateMinutes: 300,
    },
    {
      projectId: koregaon,
      title: 'Facade material board',
      status: 'in_review',
      ownerUserId: p('designer2'),
      reviewerUserId: p('pm2'),
      dueDate: '2026-10-22',
      estimateMinutes: 240,
      submittedAt: at('2026-10-20T16:00:00'),
      requiresReview: true,
    },
    {
      projectId: baner,
      title: 'Site measurement sheet',
      status: 'ready',
      ownerUserId: p('site'),
      dueDate: '2026-10-15',
      estimateMinutes: 120,
    },
    {
      projectId: saska,
      title: 'Design review checklist',
      status: 'in_progress',
      ownerUserId: p('lead'),
      plannedStartDate: '2026-10-21',
      dueDate: '2026-10-23',
      estimateMinutes: 2400,
    },
    {
      projectId: koregaon,
      title: 'Lobby 3D render',
      status: 'in_progress',
      ownerUserId: p('designer3'),
      dueDate: '2026-11-10',
      estimateMinutes: 900,
      actualMinutes: 300,
    },
    // 9–14: finished in October (Ananya and Dev) — on time, client-delayed, rework, rescheduled, shared.
    {
      projectId: saska,
      title: 'Concept presentation deck',
      ownerUserId: p('designer1'),
      requiresReview: true,
      milestoneId: fixture.conceptSignOff,
      ...done('2026-10-05T10:00:00', '2026-10-06'),
    },
    {
      projectId: saska,
      title: 'Flooring options',
      ownerUserId: p('designer1'),
      ...done('2026-10-09T12:00:00', '2026-10-07'),
    },
    {
      projectId: koregaon,
      title: 'Meeting room furniture plan',
      ownerUserId: p('designer1'),
      requiresReview: true,
      reviewRounds: 1,
      ...done('2026-10-12T15:00:00', '2026-10-12'),
    },
    {
      projectId: saska,
      title: 'Lighting concept',
      ownerUserId: p('designer1'),
      ...done('2026-10-14T11:00:00', '2026-10-16', { baselineDueDate: '2026-10-10' }),
    },
    {
      projectId: saska,
      title: 'Bathroom fixtures list',
      ownerUserId: p('designer2'),
      ...done('2026-10-15T18:00:00', '2026-10-15'),
    },
    {
      projectId: koregaon,
      title: 'Pantry layout',
      ownerUserId: p('designer2'),
      ...done('2026-10-16T12:00:00', '2026-10-13'),
    },
    // 15–16: finished in September (Ananya: one late, one on time).
    {
      projectId: saska,
      title: 'Site survey drawings',
      ownerUserId: p('designer1'),
      ...done('2026-09-10T12:00:00', '2026-09-08'),
    },
    {
      projectId: saska,
      title: 'Space planning options',
      ownerUserId: p('designer1'),
      ...done('2026-09-20T12:00:00', '2026-09-22'),
    },
  ]);
  const t = (index: number) => pick(ids, index);
  await db.insert(taskCollaborators).values({ taskId: t(13), userId: p('designer1') });
  await db.insert(taskChecklistItems).values([
    {
      taskId: t(9),
      label: 'Client brief covered',
      completedAt: at('2026-10-04T12:00:00'),
      completedByUserId: p('designer1'),
    },
    { taskId: t(11), label: 'Dimensions checked', completedAt: null },
    { taskId: t(0), label: 'Palette approved', completedAt: null },
  ]);
  await db.insert(taskBlockers).values([
    {
      taskId: t(10),
      category: 'client',
      reason: 'Waiting for the client to pick a flooring sample.',
      raisedByUserId: p('designer1'),
      raisedAt: at('2026-10-05T11:00:00'),
      resolvedAt: at('2026-10-08T10:00:00'),
      resolvedByUserId: p('pm1'),
      resolution: 'Sample chosen.',
    },
    {
      taskId: t(3),
      category: 'client',
      reason: 'Client has not confirmed the wardrobe finish.',
      raisedByUserId: p('designer1'),
      raisedAt: at('2026-10-14T10:00:00'),
    },
    {
      taskId: t(4),
      category: 'supplier',
      reason: 'Tile catalogue not received.',
      raisedByUserId: p('designer2'),
      raisedAt: at('2026-10-19T09:00:00'),
    },
  ]);
  await db.insert(taskScheduleChanges).values({
    taskId: t(12),
    previousDueDate: '2026-10-10',
    newDueDate: '2026-10-16',
    reason: 'Client added a reading nook to the brief.',
    changedByUserId: p('pm1'),
    createdAt: at('2026-10-08T09:00:00'),
  });
  await seedReviewsAndDecisions(db, p, fixture, [t(1), t(4), t(5)]);
}
