import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Database } from '../../src/client';
import * as t from '../../src/schema';
import { seedReviewsAndClientWaits } from './learning-review-fixture';

/**
 * Test-only fixture for the estimate, rework and delay reports: two projects
 * of one client (spelled differently), in the first two weeks of May 2023.
 * The expected numbers are worked out next to each record.
 */
const at = (iso: string) => new Date(iso);

async function personByPhone(db: Database, phone: string): Promise<string> {
  const [row] = await db.select().from(t.users).where(eq(t.users.phoneE164, phone));
  if (!row) throw new Error('Seed the database before running integration tests.');
  return row.id;
}

async function publishedTemplate(db: Database) {
  const [row] = await db
    .select({
      versionId: t.workflowTemplateVersions.id,
      id: t.workflowTemplates.id,
      name: t.workflowTemplates.name,
      definition: t.workflowTemplateVersions.definition,
    })
    .from(t.workflowTemplateVersions)
    .innerJoin(
      t.workflowTemplates,
      eq(t.workflowTemplates.id, t.workflowTemplateVersions.templateId),
    )
    .where(eq(t.workflowTemplateVersions.status, 'published'))
    .limit(1);
  const task = row?.definition.stages[0]?.tasks[0];
  if (!row || !task) throw new Error('Seed the workflow templates first.');
  return {
    versionId: row.versionId,
    id: row.id,
    name: row.name,
    taskKey: task.key,
    taskTitle: task.title,
  };
}

export async function seedLearningFixture(db: Database) {
  const ids = {
    owner: await personByPhone(db, '+919000000001'),
    pm: await personByPhone(db, '+919000000003'),
    designer: await personByPhone(db, '+919000000006'),
  };
  const template = await publishedTemplate(db);
  const suffix = randomUUID().slice(0, 8);
  const clientName = `Mehta Family ${suffix}`;
  const project = (letter: string, values: Partial<typeof t.projects.$inferInsert>) => ({
    reference: `LRN-${letter}-${suffix}`,
    name: `Learning fixture ${letter}`,
    projectType: 'residential_interior' as const,
    ownerUserId: ids.owner,
    managerUserId: ids.pm,
    plannedStartDate: '2023-05-01',
    plannedEndDate: '2023-06-30',
    baselineEndDate: '2023-06-30',
    createdByUserId: ids.owner,
    clientName,
    ...values,
  });
  const [projectA, projectB] = await db
    .insert(t.projects)
    .values([
      project('A', {
        templateVersionId: template.versionId,
        createdAt: at('2023-04-01T00:00:00Z'),
      }),
      // Same client, spelled in lower case with stray spaces.
      project('B', {
        clientName: `  ${clientName.toLowerCase()} `,
        createdAt: at('2023-04-02T00:00:00Z'),
      }),
    ])
    .returning();
  if (!projectA || !projectB) throw new Error('fixture projects');
  const [signoff, pendingSignoff, earlySignoff] = await db
    .insert(t.milestones)
    .values([
      // Ready when task 1 finished (3 May 06:00Z), signed off 8 May 06:00Z: 120 h, delayed.
      {
        projectId: projectA.id,
        name: 'Concept sign-off',
        dueDate: '2023-05-05',
        baselineDueDate: '2023-05-05',
        requiresClientApproval: true,
        status: 'completed',
        completedAt: at('2023-05-08T06:00:00Z'),
      },
      // No tasks, due 5 May: ready at 00:00 that day and still waiting.
      {
        projectId: projectB.id,
        name: 'Material sign-off',
        dueDate: '2023-05-05',
        baselineDueDate: '2023-05-05',
        requiresClientApproval: true,
      },
      // Signed off before its due date with no done task: clamped to 0 h.
      {
        projectId: projectB.id,
        name: 'Layout sign-off',
        dueDate: '2023-05-05',
        baselineDueDate: '2023-05-05',
        requiresClientApproval: true,
        status: 'completed',
        completedAt: at('2023-05-02T00:00:00Z'),
      },
    ])
    .returning();
  if (!signoff || !pendingSignoff || !earlySignoff) throw new Error('fixture milestones');
  const task = (
    projectId: string,
    number: number,
    values: Partial<typeof t.tasks.$inferInsert>,
  ) => ({
    projectId,
    number,
    title: `Learning task ${number}`,
    ownerUserId: ids.designer,
    status: 'done' as const,
    ...values,
  });
  const done = (iso: string) => ({ completedAt: at(iso) });
  const rows = await db
    .insert(t.tasks)
    .values([
      // Template task, 100 estimated, 50 + 40 logged: 0.9, within.
      task(projectA.id, 1, {
        templateKey: template.taskKey,
        estimateMinutes: 100,
        milestoneId: signoff.id,
        ...done('2023-05-03T06:00:00Z'),
      }),
      // Template task, 60 estimated, 90 logged: 1.5, over (second week).
      task(projectA.id, 2, {
        templateKey: template.taskKey,
        estimateMinutes: 60,
        ...done('2023-05-10T06:00:00Z'),
      }),
      // Estimated, nothing logged: not measured.
      task(projectA.id, 3, { estimateMinutes: 120, ...done('2023-05-04T06:00:00Z') }),
      // No estimate.
      task(projectA.id, 4, { ...done('2023-05-04T06:00:00Z') }),
      // The manager's task, 200 estimated, 100 logged: 0.5, under.
      task(projectA.id, 5, {
        ownerUserId: ids.pm,
        estimateMinutes: 200,
        ...done('2023-05-05T06:00:00Z'),
      }),
      // Not done, and archived: never counted.
      task(projectA.id, 6, { status: 'in_progress', estimateMinutes: 100 }),
      task(projectA.id, 7, {
        estimateMinutes: 100,
        archivedAt: at('2023-05-06T00:00:00Z'),
        ...done('2023-05-05T06:00:00Z'),
      }),
      task(projectB.id, 1, { status: 'in_progress' }),
    ])
    .returning();
  const byNumber = (projectId: string, number: number) => {
    const row = rows.find((item) => item.projectId === projectId && item.number === number);
    if (!row) throw new Error('fixture task');
    return row.id;
  };
  const session = (taskNumber: number, userId: string, start: string, minutes: number | null) => ({
    taskId: byNumber(projectA.id, taskNumber),
    userId,
    startedAt: at(start),
    endedAt: minutes === null ? null : new Date(at(start).getTime() + minutes * 60_000),
  });
  await db
    .insert(t.workSessions)
    .values([
      session(1, ids.designer, '2023-05-02T04:00:00Z', 50),
      session(1, ids.pm, '2023-05-02T08:00:00Z', 40),
      session(1, ids.designer, '2023-05-03T04:00:00Z', null),
      session(2, ids.designer, '2023-05-09T04:00:00Z', 90),
      session(5, ids.pm, '2023-05-04T04:00:00Z', 100),
      session(6, ids.designer, '2023-05-04T04:00:00Z', 30),
      session(7, ids.designer, '2023-05-04T04:00:00Z', 30),
    ]);
  const file = await seedReviewsAndClientWaits(db, {
    people: ids,
    projectId: projectA.id,
    reviewedTaskId: byNumber(projectA.id, 1),
    waitingTaskId: byNumber(projectA.id, 2),
    blockedTaskId: byNumber(projectB.id, 1),
  });
  return {
    ids: {
      ...ids,
      projectA: projectA.id,
      projectB: projectB.id,
      file,
      reviewedTask: byNumber(projectA.id, 1),
    },
    template,
    clientName,
  };
}
