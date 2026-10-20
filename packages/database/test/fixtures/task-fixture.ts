import type { ProjectRole } from '@lintel/domain';
import { addDays, type CalendarDate } from '@lintel/shared';
import { eq, inArray } from 'drizzle-orm';
import type { Database } from '../../src/client';
import {
  deliverables,
  milestones,
  projectMembers,
  projectStages,
  projects,
  taskChecklistItems,
  taskCollaborators,
  taskDependencies,
  tasks,
  users,
} from '../../src/schema';

/**
 * Test-only fixture: projects with members, stages, milestones, tasks,
 * dependencies, checklists and a required deliverable, inserted directly
 * through Drizzle (the project-creation route is built elsewhere).
 */
export interface TaskFixture {
  readonly people: Record<string, string>;
  readonly projectId: string;
  readonly otherProjectId: string;
  readonly stageIds: string[];
  readonly milestoneIds: string[];
  readonly tasks: Record<
    'measure' | 'moodboard' | 'drawings' | 'electrical' | 'sourcing' | 'other',
    string
  >;
  readonly deliverableId: string;
}

const PHONES: Record<string, string> = {
  owner: '+919000000001',
  admin: '+919000000002',
  pm1: '+919000000003',
  pm2: '+919000000004',
  lead: '+919000000005',
  designer1: '+919000000006',
  designer2: '+919000000007',
  designer3: '+919000000008',
  architect: '+919000000009',
  site: '+919000000010',
};

async function seededPeople(db: Database): Promise<Record<string, string>> {
  const rows = await db
    .select({ id: users.id, phone: users.phoneE164 })
    .from(users)
    .where(inArray(users.phoneE164, Object.values(PHONES)));
  const byPhone = new Map(rows.map((row) => [row.phone, row.id]));
  const people: Record<string, string> = {};
  for (const [key, phone] of Object.entries(PHONES)) {
    const id = byPhone.get(phone);
    if (!id) throw new Error(`Seed person ${key} is missing. Run the database seed first.`);
    people[key] = id;
  }
  return people;
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Fixture insert returned no ${what}.`);
  return value;
}

export async function createTaskFixture(db: Database, today: CalendarDate): Promise<TaskFixture> {
  const people = await seededPeople(db);
  const person = (key: string) => must(people[key], key);
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  const project = async (name: string, manager: string, members: [string, ProjectRole][]) => {
    const [row] = await db
      .insert(projects)
      .values({
        reference: `ARN-T${suffix}-${name.slice(0, 3).toUpperCase()}`,
        name,
        clientName: 'Fixture client',
        projectType: 'residential_interior',
        ownerUserId: person('owner'),
        managerUserId: person(manager),
        plannedStartDate: addDays(today, -10),
        plannedEndDate: addDays(today, 60),
        baselineEndDate: addDays(today, 60),
        createdByUserId: person('owner'),
      })
      .returning({ id: projects.id });
    const id = must(row, 'project').id;
    await db.insert(projectMembers).values(
      members.map(([key, projectRole]) => ({
        projectId: id,
        userId: person(key),
        projectRole,
      })),
    );
    return id;
  };
  const projectId = await project(`Kapoor Residence ${suffix}`, 'pm1', [
    ['pm1', 'manager'],
    ['lead', 'reviewer'],
    ['designer1', 'designer'],
    ['designer2', 'designer'],
    ['site', 'site_supervisor'],
  ]);
  const otherProjectId = await project(`Mehra Office ${suffix}`, 'pm2', [
    ['pm2', 'manager'],
    ['designer3', 'designer'],
  ]);
  const stageRows = await db
    .insert(projectStages)
    .values([
      { projectId, name: 'Concept', position: 1, status: 'active' as const },
      { projectId, name: 'Design development', position: 2 },
    ])
    .returning({ id: projectStages.id });
  const stageIds = stageRows.map((row) => row.id);
  const milestoneRows = await db
    .insert(milestones)
    .values([
      {
        projectId,
        stageId: stageIds[0] ?? null,
        name: 'Concept sign-off',
        dueDate: addDays(today, 3),
        baselineDueDate: addDays(today, 3),
      },
      {
        projectId,
        stageId: stageIds[1] ?? null,
        name: 'Drawings issued',
        dueDate: addDays(today, 20),
        baselineDueDate: addDays(today, 20),
      },
    ])
    .returning({ id: milestones.id });
  const milestoneIds = milestoneRows.map((row) => row.id);
  let number = 0;
  const task = async (values: Partial<typeof tasks.$inferInsert> & { title: string }) => {
    number += 1;
    const [row] = await db
      .insert(tasks)
      .values({
        projectId,
        number,
        status: 'ready',
        createdByUserId: person('pm1'),
        ...values,
        baselineDueDate: values.dueDate ?? null,
      })
      .returning({ id: tasks.id });
    return must(row, 'task').id;
  };
  const measure = await task({
    title: 'Measure the site',
    ownerUserId: person('designer1'),
    dueDate: addDays(today, 1),
    stageId: stageIds[0] ?? null,
    milestoneId: milestoneIds[0] ?? null,
    estimateMinutes: 180,
    priority: 'high',
  });
  const moodboard = await task({
    title: 'Concept moodboard',
    ownerUserId: person('designer1'),
    reviewerUserId: person('lead'),
    requiresReview: true,
    dueDate: addDays(today, 3),
    stageId: stageIds[0] ?? null,
    milestoneId: milestoneIds[0] ?? null,
  });
  const drawings = await task({
    title: 'Working drawings',
    status: 'draft',
    ownerUserId: person('designer2'),
    stageId: stageIds[1] ?? null,
    milestoneId: milestoneIds[1] ?? null,
  });
  const electrical = await task({
    title: 'Electrical layout',
    status: 'in_progress',
    ownerUserId: person('designer2'),
    dueDate: addDays(today, 5),
    startedAt: new Date(),
  });
  const sourcing = await task({
    title: 'Material sourcing',
    ownerUserId: person('designer1'),
    dueDate: addDays(today, -1),
    priority: 'urgent',
  });
  const [otherRow] = await db
    .insert(tasks)
    .values({
      projectId: otherProjectId,
      number: 1,
      title: 'Office space plan',
      status: 'ready',
      ownerUserId: person('designer3'),
      dueDate: addDays(today, 4),
      baselineDueDate: addDays(today, 4),
      createdByUserId: person('pm2'),
    })
    .returning({ id: tasks.id });
  await db.insert(taskDependencies).values([
    { taskId: moodboard, dependsOnTaskId: measure },
    { taskId: drawings, dependsOnTaskId: moodboard },
  ]);
  await db.insert(taskCollaborators).values({ taskId: electrical, userId: person('designer1') });
  await db.insert(taskChecklistItems).values([
    { taskId: measure, label: 'Laser-measure every room', isRequired: true, position: 0 },
    { taskId: measure, label: 'Photograph the services', isRequired: true, position: 1 },
    { taskId: measure, label: 'Note neighbour access', isRequired: false, position: 2 },
    { taskId: moodboard, label: 'Three palette options', isRequired: true, position: 0 },
  ]);
  const [deliverable] = await db
    .insert(deliverables)
    .values({
      projectId,
      taskId: moodboard,
      name: 'Moodboard PDF',
      isRequired: true,
      reviewerUserId: person('lead'),
    })
    .returning({ id: deliverables.id });
  return {
    people,
    projectId,
    otherProjectId,
    stageIds,
    milestoneIds,
    tasks: {
      measure,
      moodboard,
      drawings,
      electrical,
      sourcing,
      other: must(otherRow, 'task').id,
    },
    deliverableId: must(deliverable, 'deliverable').id,
  };
}

/** Removes a fixture's projects (everything else cascades). */
export async function removeTaskFixture(db: Database, fixture: TaskFixture): Promise<void> {
  for (const id of [fixture.projectId, fixture.otherProjectId]) {
    await db.delete(projects).where(eq(projects.id, id));
  }
}
