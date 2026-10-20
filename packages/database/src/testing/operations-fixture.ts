import { eq, inArray } from 'drizzle-orm';
import type { Database, DatabaseExecutor } from '../client';
import { milestones, projectMembers, projects, users } from '../schema';
import { SEED_PEOPLE } from '../seed/seed-people';
import { seedFixtureWork } from './operations-fixture-work';

export type FixturePeople = Readonly<Record<string, string>>;

export interface FixtureProjects {
  readonly saska: string;
  readonly koregaon: string;
  readonly baner: string;
  readonly designFreeze: string;
  readonly conceptSignOff: string;
  readonly drawingsIssued: string;
}

const at = (value: string) => new Date(`${value}+05:30`);

async function people(db: DatabaseExecutor): Promise<FixturePeople> {
  const rows = await db
    .select({ id: users.id, phone: users.phoneE164 })
    .from(users)
    .where(
      inArray(
        users.phoneE164,
        SEED_PEOPLE.map((person) => person.phoneE164),
      ),
    );
  const byKey: Record<string, string> = {};
  for (const person of SEED_PEOPLE) {
    const row = rows.find((candidate) => candidate.phone === person.phoneE164);
    if (!row) throw new Error(`Seed person ${person.key} is missing. Run the database seed first.`);
    byKey[person.key] = row.id;
  }
  return byKey;
}

function person(map: FixturePeople, key: string): string {
  const id = map[key];
  if (!id) throw new Error(`Unknown fixture person ${key}`);
  return id;
}

async function project(
  db: DatabaseExecutor,
  values: Omit<typeof projects.$inferInsert, 'baselineEndDate'>,
): Promise<string> {
  const [row] = await db
    .insert(projects)
    .values({ ...values, baselineEndDate: values.plannedEndDate })
    .returning({ id: projects.id });
  if (!row) throw new Error('Fixture project was not created.');
  return row.id;
}

async function seedProjects(db: DatabaseExecutor, map: FixturePeople): Promise<FixtureProjects> {
  const owner = person(map, 'owner');
  const common = { ownerUserId: owner, createdByUserId: owner, status: 'active' as const };
  const saska = await project(db, {
    ...common,
    reference: 'ARN-FX-001',
    name: 'Saska Residence',
    clientName: 'Mehra family',
    projectType: 'residential_interior',
    criticality: 'high',
    managerUserId: person(map, 'pm1'),
    plannedStartDate: '2026-09-01',
    plannedEndDate: '2026-12-20',
    colorIndex: 1,
  });
  const koregaon = await project(db, {
    ...common,
    reference: 'ARN-FX-002',
    name: 'Koregaon Office',
    clientName: 'Northwind Labs',
    projectType: 'commercial_interior',
    managerUserId: person(map, 'pm2'),
    plannedStartDate: '2026-08-15',
    plannedEndDate: '2026-11-30',
    colorIndex: 2,
  });
  const baner = await project(db, {
    ...common,
    reference: 'ARN-FX-003',
    name: 'Baner Villa',
    clientName: 'Rao residence',
    projectType: 'architecture',
    managerUserId: person(map, 'pm1'),
    plannedStartDate: '2026-07-01',
    plannedEndDate: '2026-10-31',
    colorIndex: 3,
  });
  const members: (typeof projectMembers.$inferInsert)[] = [
    { projectId: saska, userId: person(map, 'pm1'), projectRole: 'manager' },
    { projectId: saska, userId: person(map, 'lead'), projectRole: 'reviewer' },
    { projectId: saska, userId: person(map, 'designer1'), projectRole: 'designer' },
    { projectId: saska, userId: person(map, 'designer2'), projectRole: 'designer' },
    { projectId: saska, userId: person(map, 'site'), projectRole: 'site_supervisor' },
    { projectId: koregaon, userId: person(map, 'pm2'), projectRole: 'manager' },
    { projectId: koregaon, userId: person(map, 'architect'), projectRole: 'architect' },
    { projectId: koregaon, userId: person(map, 'designer1'), projectRole: 'designer' },
    { projectId: koregaon, userId: person(map, 'designer2'), projectRole: 'designer' },
    { projectId: koregaon, userId: person(map, 'designer3'), projectRole: 'designer' },
    { projectId: baner, userId: person(map, 'pm1'), projectRole: 'manager' },
    { projectId: baner, userId: person(map, 'designer3'), projectRole: 'designer' },
  ];
  await db.insert(projectMembers).values(members);
  const [designFreeze, conceptSignOff, drawingsIssued] = await db
    .insert(milestones)
    .values([
      {
        projectId: saska,
        name: 'Design freeze',
        dueDate: '2026-10-28',
        baselineDueDate: '2026-10-28',
      },
      {
        projectId: saska,
        name: 'Concept sign-off',
        dueDate: '2026-10-06',
        baselineDueDate: '2026-10-06',
        status: 'completed',
        completedAt: at('2026-10-05T17:00:00'),
        completedByUserId: person(map, 'pm1'),
      },
      {
        projectId: koregaon,
        name: 'Working drawings issued',
        dueDate: '2026-11-04',
        baselineDueDate: '2026-11-04',
      },
    ])
    .returning({ id: milestones.id });
  if (!designFreeze || !conceptSignOff || !drawingsIssued) throw new Error('Milestones missing.');
  return {
    saska,
    koregaon,
    baner,
    designFreeze: designFreeze.id,
    conceptSignOff: conceptSignOff.id,
    drawingsIssued: drawingsIssued.id,
  };
}

/**
 * Development fixture for leave, capacity, rewards and the command center:
 * three projects, open and finished work (with blockers, schedule changes,
 * reviews and checklists), a deliverable in review, a scope change and a
 * priority conflict. Dates are around 21 October 2026. Runs once.
 */
export async function seedOperationsFixture(db: Database): Promise<'created' | 'exists'> {
  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.reference, 'ARN-FX-001'));
  if (existing) return 'exists';
  await db.transaction(async (tx) => {
    const map = await people(tx);
    const fixture = await seedProjects(tx, map);
    await seedFixtureWork(tx, map, fixture);
  });
  return 'created';
}

export { at as fixtureInstant, person as fixturePerson };
