import { inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { leaveTypes, milestones, projects, tasks, teams, users } from '../../schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REFERENCES = 500;

function collectIds(value: unknown, depth: number, found: Set<string>): void {
  if (found.size >= MAX_REFERENCES || depth > 6) return;
  if (typeof value === 'string') {
    if (UUID.test(value)) found.add(value);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  const children = Array.isArray(value) ? value : Object.values(value);
  for (const child of children) collectIds(child, depth + 1, found);
}

/** Every id-shaped string anywhere inside recorded audit snapshots. */
export function referencedIds(snapshots: readonly unknown[]): string[] {
  const found = new Set<string>();
  for (const snapshot of snapshots) collectIds(snapshot, 0, found);
  return [...found];
}

/**
 * Readable names for ids recorded in audit details, so the log can say
 * "#12 Measure the site" instead of a UUID. Ids that are not a task, person,
 * project, milestone, team or leave type stay unnamed.
 */
export async function loadAuditNames(
  db: DatabaseExecutor,
  ids: readonly string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const list = [...ids];
  const [taskRows, userRows, projectRows, milestoneRows, teamRows, leaveTypeRows] =
    await Promise.all([
      db
        .select({ id: tasks.id, number: tasks.number, title: tasks.title })
        .from(tasks)
        .where(inArray(tasks.id, list)),
      db.select({ id: users.id, name: users.fullName }).from(users).where(inArray(users.id, list)),
      db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(inArray(projects.id, list)),
      db
        .select({ id: milestones.id, name: milestones.name })
        .from(milestones)
        .where(inArray(milestones.id, list)),
      db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, list)),
      db
        .select({ id: leaveTypes.id, name: leaveTypes.name })
        .from(leaveTypes)
        .where(inArray(leaveTypes.id, list)),
    ]);
  const names: Record<string, string> = {};
  for (const row of taskRows) names[row.id] = `#${row.number} ${row.title}`;
  for (const row of [
    ...userRows,
    ...projectRows,
    ...milestoneRows,
    ...teamRows,
    ...leaveTypeRows,
  ]) {
    names[row.id] = row.name;
  }
  return names;
}
