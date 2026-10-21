import { eq } from 'drizzle-orm';
import { projects } from '../../schema';
import type { DemoContext } from './demo-context';
import { seedCostLedger } from './demo-history-costs';
import { seedLeaveHistory } from './demo-history-leave';
import { backdateMilestones } from './demo-history-milestones';
import {
  closeFinishedProject,
  DEMO_HISTORY_PROJECTS,
  HISTORY_MARKER_PROJECT,
  loadHistoryScope,
} from './demo-history-projects';
import { seedReviewHistory } from './demo-history-reviews';
import { seedScopeChangeHistory } from './demo-history-scope';
import { createHistoryClock } from './demo-history-time';
import { retimeDoneTasks } from './demo-history-timing';
import { seedWorkSessions } from './demo-history-work';
import { DEMO_PROJECTS, type DemoProject } from './demo-projects';

/**
 * Completed history for the reports: two finished projects, realistic
 * delivery timing, logged work, leave, reviews, scope decisions and cost
 * ledgers. Runs once — skipped entirely when the first finished project
 * already exists — and is deterministic: variation comes from names and
 * task numbers, never chance. Returns a summary line, or null when skipped.
 */
export async function seedDemoHistory(
  context: DemoContext,
  createProject: (demo: DemoProject) => Promise<string>,
): Promise<string | null> {
  const db = context.db;
  const [marker] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.name, HISTORY_MARKER_PROJECT))
    .limit(1);
  if (marker) return null;
  const calendar = await context.deps.uow.stores.settings.defaultCalendar();
  const clock = createHistoryClock(context.deps.clock.now(), context.timeZone, calendar);
  for (const demo of DEMO_HISTORY_PROJECTS) await createProject(demo);
  const scope = await loadHistoryScope(db, [
    ...DEMO_PROJECTS.map((demo) => demo.name),
    ...DEMO_HISTORY_PROJECTS.map((demo) => demo.name),
  ]);
  for (const project of scope.filter((candidate) => candidate.isFinished)) {
    if (project.plannedEndDate >= clock.shift(clock.today, -7)) {
      throw new Error(`"${project.name}" must end at least a week before today.`);
    }
  }
  const timing = await retimeDoneTasks(db, clock, scope);
  const signOffs = await backdateMilestones(db, clock, scope);
  for (const project of scope.filter((candidate) => candidate.isFinished)) {
    await closeFinishedProject(context, clock, project);
  }
  const leave = await seedLeaveHistory(context, clock);
  const work = await seedWorkSessions(db, clock, scope, leave.daysOff);
  const reviews = await seedReviewHistory(db, clock, scope, context.personId('owner'));
  const scopeChanges = await seedScopeChangeHistory(context, clock, scope);
  const costs = await seedCostLedger(db, clock, scope);
  return [
    `Demo history (${DEMO_HISTORY_PROJECTS.length} completed projects`,
    `${timing.late} late / ${timing.early} early tasks`,
    `${signOffs.late} of ${signOffs.completed} milestones late`,
    `${work.sessions} work sessions`,
    `${leave.requests} leave requests`,
    `${reviews.decided} reviewed versions + ${reviews.waiting} waiting`,
    `${scopeChanges} decided scope changes`,
    `${costs.entries} cost entries)`,
  ].join(', ');
}
