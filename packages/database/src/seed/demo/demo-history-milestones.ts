import { nextWorkingDayOnOrAfter } from '@lintel/domain';
import { addDays } from '@lintel/shared';
import { and, asc, eq, inArray, isNotNull, max, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import { activityEvents, milestones, projectStages, tasks } from '../../schema';
import type { HistoryProject } from './demo-history-projects';
import { type HistoryClock, latestOf, plusMinutes, stableHash } from './demo-history-time';
import { COMPLETION_TIME } from './demo-history-timing';

interface CompletedMilestone {
  readonly id: string;
  readonly projectId: string;
  readonly stageId: string | null;
  readonly name: string;
  readonly dueDate: string;
  readonly requiresClientApproval: boolean;
}

/**
 * Days between the last linked task and the sign-off: usually none; about a
 * fifth of client approvals wait 1–2 days for the client and a few others a
 * day. When the work itself finished late the sign-off follows at once.
 */
function signOffDelayDays(
  milestone: CompletedMilestone,
  projectName: string,
  workFinishedLate: boolean,
): number {
  if (workFinishedLate) return 0;
  const roll = stableHash(`${projectName}/${milestone.name}`) % 100;
  if (milestone.requiresClientApproval) return roll < 20 ? 1 + (roll % 2) : 0;
  return roll < 6 ? 1 : 0;
}

async function latestTaskCompletions(db: Database, milestoneIds: readonly string[]) {
  const rows = await db
    .select({ milestoneId: tasks.milestoneId, at: max(tasks.completedAt) })
    .from(tasks)
    .where(and(inArray(tasks.milestoneId, [...milestoneIds]), isNotNull(tasks.completedAt)))
    .groupBy(tasks.milestoneId);
  return new Map(
    rows.flatMap((row) => (row.milestoneId && row.at ? [[row.milestoneId, row.at]] : [])),
  );
}

/**
 * The seed completes due milestones "now"; this dates each sign-off after
 * the last of its tasks instead, and moves its feed entry with it.
 */
export async function backdateMilestones(
  db: Database,
  clock: HistoryClock,
  scope: readonly HistoryProject[],
): Promise<{ completed: number; late: number }> {
  const names = new Map(scope.map((project) => [project.id, project.name]));
  const rows: CompletedMilestone[] = await db
    .select({
      id: milestones.id,
      projectId: milestones.projectId,
      stageId: milestones.stageId,
      name: milestones.name,
      dueDate: milestones.dueDate,
      requiresClientApproval: milestones.requiresClientApproval,
    })
    .from(milestones)
    .where(
      and(inArray(milestones.projectId, [...names.keys()]), eq(milestones.status, 'completed')),
    );
  if (rows.length === 0) return { completed: 0, late: 0 };
  const latest = await latestTaskCompletions(
    db,
    rows.map((row) => row.id),
  );
  let late = 0;
  for (const milestone of rows) {
    const lastTask = latest.get(milestone.id) ?? clock.at(milestone.dueDate, COMPLETION_TIME);
    const delay = signOffDelayDays(
      milestone,
      names.get(milestone.projectId) ?? '',
      clock.dateOf(lastTask) > milestone.dueDate,
    );
    const signedOff =
      delay === 0
        ? plusMinutes(lastTask, 40)
        : clock.at(
            nextWorkingDayOnOrAfter(clock.calendar, addDays(clock.dateOf(lastTask), delay)),
            '12:15',
          );
    const completedAt = clock.past(signedOff);
    if (clock.dateOf(completedAt) > milestone.dueDate) late += 1;
    await db
      .update(milestones)
      .set({ completedAt, updatedAt: completedAt })
      .where(eq(milestones.id, milestone.id));
    await db
      .update(activityEvents)
      .set({ createdAt: completedAt })
      .where(
        and(
          eq(activityEvents.type, 'milestone.completed'),
          sql`${activityEvents.payload}->>'milestoneId' = ${milestone.id}`,
        ),
      );
  }
  for (const project of scope) await backdateStages(db, clock, project);
  return { completed: rows.length, late };
}

async function dateStage(
  db: Database,
  stageId: string,
  times: { startedAt: Date | null; completedAt: Date | null },
) {
  const { startedAt, completedAt } = times;
  if (startedAt) {
    await db.update(projectStages).set({ startedAt }).where(eq(projectStages.id, stageId));
  }
  if (!completedAt) return;
  await db
    .update(projectStages)
    .set({ completedAt, updatedAt: completedAt })
    .where(eq(projectStages.id, stageId));
  await db
    .update(activityEvents)
    .set({ createdAt: completedAt })
    .where(
      and(
        eq(activityEvents.type, 'stage.completed'),
        sql`${activityEvents.payload}->>'stageId' = ${stageId}`,
      ),
    );
}

/**
 * Stages close with their last milestone; each later stage started when the
 * one before it closed, the first one on the project's planned start.
 */
async function backdateStages(db: Database, clock: HistoryClock, project: HistoryProject) {
  const stages = await db
    .select({
      id: projectStages.id,
      status: projectStages.status,
      startedAt: projectStages.startedAt,
    })
    .from(projectStages)
    .where(eq(projectStages.projectId, project.id))
    .orderBy(asc(projectStages.position));
  const signOffs = await db
    .select({ stageId: milestones.stageId, at: max(milestones.completedAt) })
    .from(milestones)
    .where(and(eq(milestones.projectId, project.id), eq(milestones.status, 'completed')))
    .groupBy(milestones.stageId);
  const closedAt = new Map(signOffs.map((row) => [row.stageId, row.at]));
  let previousClose: Date | null = clock.at(project.plannedStartDate, '10:00');
  for (const stage of stages) {
    const completedAt =
      stage.status === 'completed' ? latestOf([closedAt.get(stage.id) ?? null]) : null;
    const startedAt = stage.startedAt && previousClose ? clock.past(previousClose) : null;
    await dateStage(db, stage.id, { startedAt, completedAt });
    previousClose = completedAt;
  }
}
