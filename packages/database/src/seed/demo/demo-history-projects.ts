import { ManageProjectCommands } from '@lintel/application';
import { and, eq, inArray, max } from 'drizzle-orm';
import type { Database } from '../../client';
import { activityEvents, milestones, notifications, projects, tasks } from '../../schema';
import type { DemoContext } from './demo-context';
import { type HistoryClock, latestOf, plusHours, plusMinutes } from './demo-history-time';
import type { DemoProject } from './demo-projects';

const NO_PROGRESS = { overdue: 0, inReview: 0, blockers: [] } as const;

/** Marks that the history has been written: the first completed project, looked up by name. */
export const HISTORY_MARKER_PROJECT = 'Fernhill Courtyard Home';

/**
 * Two finished projects from earlier in the year, created through the same
 * use cases as the live demo projects. Both templates end well before today
 * (about 47 and 35 working days long), so every task is in the past.
 */
export const DEMO_HISTORY_PROJECTS: readonly DemoProject[] = [
  {
    name: HISTORY_MARKER_PROJECT,
    clientName: 'Kavya & Neel Fernhill',
    siteAddress: 'House 9, Example Enclave, Nashik',
    projectType: 'interior_and_execution',
    criticality: 'normal',
    description: 'Courtyard family home: interiors, joinery and site execution.',
    manager: 'pm1',
    members: [
      { person: 'designer2', role: 'designer' },
      { person: 'site', role: 'site_supervisor' },
      { person: 'lead', role: 'reviewer' },
    ],
    options: ['includes_execution'],
    startedWorkingDaysAgo: 110,
    budgetMinor: 4_600_000_00,
    progress: NO_PROGRESS,
  },
  {
    name: 'Tamarind Studio Pavilion',
    clientName: 'Tamarind Arts Collective (fictional)',
    siteAddress: 'Survey 41, Imaginary Hills, Lonavala',
    projectType: 'architecture',
    criticality: 'high',
    description: 'Single-storey pottery studio and gallery pavilion: concept to tender.',
    manager: 'pm2',
    members: [
      { person: 'architect', role: 'architect' },
      { person: 'lead', role: 'reviewer' },
    ],
    options: [],
    startedWorkingDaysAgo: 75,
    budgetMinor: 2_800_000_00,
    progress: NO_PROGRESS,
  },
];

/** A demo project as the history steps need it. */
export interface HistoryProject {
  readonly id: string;
  readonly name: string;
  readonly managerUserId: string;
  readonly ownerUserId: string;
  readonly plannedStartDate: string;
  readonly plannedEndDate: string;
  readonly budgetMinor: number | null;
  /** One of the two finished projects above. */
  readonly isFinished: boolean;
}

export async function loadHistoryScope(
  db: Database,
  names: readonly string[],
): Promise<HistoryProject[]> {
  const finished = new Set(DEMO_HISTORY_PROJECTS.map((project) => project.name));
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      managerUserId: projects.managerUserId,
      ownerUserId: projects.ownerUserId,
      plannedStartDate: projects.plannedStartDate,
      plannedEndDate: projects.plannedEndDate,
      budgetMinor: projects.budgetMinor,
    })
    .from(projects)
    .where(inArray(projects.name, [...names]));
  return rows.map((row) => ({ ...row, isFinished: finished.has(row.name) }));
}

/**
 * The project, its plan and its assignment notices were "created" a few
 * working days before the planned start; the notices have long been read.
 */
async function backdateCreation(db: Database, clock: HistoryClock, project: HistoryProject) {
  const createdAt = clock.at(clock.shift(project.plannedStartDate, -3), '11:00');
  await db.update(projects).set({ createdAt }).where(eq(projects.id, project.id));
  await db.update(tasks).set({ createdAt }).where(eq(tasks.projectId, project.id));
  await db
    .update(activityEvents)
    .set({ createdAt })
    .where(
      and(eq(activityEvents.projectId, project.id), eq(activityEvents.type, 'project.created')),
    );
  await db
    .update(notifications)
    .set({ createdAt: plusMinutes(createdAt, 2), readAt: plusHours(createdAt, 20) })
    .where(and(eq(notifications.subjectId, project.id), eq(notifications.kind, 'task_assigned')));
}

/**
 * Closes a finished project through the real status change, then dates it:
 * the actual end is the day of its last completion and the feed entry
 * follows that completion.
 */
export async function closeFinishedProject(
  context: DemoContext,
  clock: HistoryClock,
  project: HistoryProject,
): Promise<void> {
  const db = context.db;
  const demo = DEMO_HISTORY_PROJECTS.find((candidate) => candidate.name === project.name);
  if (!demo) return;
  await backdateCreation(db, clock, project);
  const [current] = await db
    .select({ version: projects.version })
    .from(projects)
    .where(eq(projects.id, project.id));
  if (!current) return;
  await new ManageProjectCommands(context.deps).changeStatus(
    await context.actingAs(demo.manager),
    project.id,
    current.version,
    'completed',
    'Handed over to the client; snag list closed.',
  );
  const [taskEnd] = await db
    .select({ at: max(tasks.completedAt) })
    .from(tasks)
    .where(eq(tasks.projectId, project.id));
  const [milestoneEnd] = await db
    .select({ at: max(milestones.completedAt) })
    .from(milestones)
    .where(eq(milestones.projectId, project.id));
  const lastCompletion = latestOf([taskEnd?.at ?? null, milestoneEnd?.at ?? null]);
  if (!lastCompletion) return;
  const closedAt = clock.past(plusMinutes(lastCompletion, 90));
  await db
    .update(projects)
    .set({ actualEndDate: clock.dateOf(lastCompletion), updatedAt: closedAt })
    .where(eq(projects.id, project.id));
  await db
    .update(activityEvents)
    .set({ createdAt: closedAt })
    .where(
      and(
        eq(activityEvents.projectId, project.id),
        eq(activityEvents.type, 'project.status_changed'),
      ),
    );
}
