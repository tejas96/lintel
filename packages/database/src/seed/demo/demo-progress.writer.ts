import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import { activityEvents, milestones, taskBlockers, taskChecklistItems, tasks } from '../../schema';
import { type DemoTaskState, planDemoProgress } from './demo-progress.plan';
import type { DemoProgress } from './demo-projects';

const DAY_MS = 86_400_000;

/** 10:30 / 17:30 in India, as UTC instants, for a calendar date. */
function morningOf(date: string | null): Date {
  return date ? new Date(`${date}T05:00:00Z`) : new Date();
}
function eveningOf(date: string | null): Date {
  return date ? new Date(`${date}T12:00:00Z`) : new Date();
}

async function writeTask(db: Database, state: DemoTaskState, managerUserId: string) {
  const { task, status } = state;
  if (status === 'ready' || status === 'draft') return;
  const started = morningOf(task.plannedStartDate);
  const completed = eveningOf(task.dueDate);
  const actor = task.ownerUserId ?? managerUserId;
  await db
    .update(tasks)
    .set({
      status,
      startedAt: started,
      acknowledgedAt: started,
      ...(status === 'done' ? { completedAt: completed, completedByUserId: actor } : {}),
      ...(status === 'in_review'
        ? { submittedAt: new Date(Date.now() - 3 * 3_600_000), reviewRounds: 1 }
        : {}),
      version: sql`${tasks.version} + 1`,
    })
    .where(eq(tasks.id, task.id));
  const items = await db
    .select({ id: taskChecklistItems.id })
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.taskId, task.id))
    .orderBy(asc(taskChecklistItems.position));
  const ticked = status === 'done' ? items : items.slice(0, 1);
  if (ticked.length > 0) {
    await db
      .update(taskChecklistItems)
      .set({ completedAt: status === 'done' ? completed : started, completedByUserId: actor })
      .where(
        inArray(
          taskChecklistItems.id,
          ticked.map((item) => item.id),
        ),
      );
  }
  if (state.blocker) {
    await db.insert(taskBlockers).values({
      taskId: task.id,
      category: state.blocker.category,
      reason: state.blocker.reason,
      raisedByUserId: actor,
      raisedAt: new Date(Date.now() - state.blocker.raisedDaysAgo * DAY_MS),
    });
  }
}

async function recordActivity(db: Database, projectId: string, states: readonly DemoTaskState[]) {
  const rows = states.flatMap(({ task, status, blocker }) => {
    const actorUserId = task.ownerUserId;
    if (status === 'done') {
      return [
        {
          projectId,
          taskId: task.id,
          actorUserId,
          type: 'task.completed',
          summary: `Completed #${task.number} ${task.title}.`,
          createdAt: eveningOf(task.dueDate),
        },
      ];
    }
    if (blocker) {
      return [
        {
          projectId,
          taskId: task.id,
          actorUserId,
          type: 'task.blocked',
          summary: `Blocked #${task.number} ${task.title}: ${blocker.reason}`,
          createdAt: new Date(Date.now() - blocker.raisedDaysAgo * DAY_MS),
        },
      ];
    }
    return [];
  });
  if (rows.length > 0) await db.insert(activityEvents).values(rows);
}

/**
 * Moves a freshly created demo project to "today": statuses, checklist
 * ticks, blockers and feed entries. Returns pending milestones that are due
 * and have no open work left, so the caller can complete them properly.
 */
export async function applyDemoProgress(
  db: Database,
  project: { id: string; managerUserId: string },
  progress: DemoProgress,
  today: string,
): Promise<{ id: string; version: number }[]> {
  const taskRows = await db
    .select({
      id: tasks.id,
      number: tasks.number,
      title: tasks.title,
      ownerUserId: tasks.ownerUserId,
      plannedStartDate: tasks.plannedStartDate,
      dueDate: tasks.dueDate,
      requiresReview: tasks.requiresReview,
      milestoneId: tasks.milestoneId,
      parentTaskId: tasks.parentTaskId,
    })
    .from(tasks)
    .where(eq(tasks.projectId, project.id))
    .orderBy(asc(tasks.number));
  const milestoneRows = await db
    .select({ id: milestones.id, dueDate: milestones.dueDate, version: milestones.version })
    .from(milestones)
    .where(eq(milestones.projectId, project.id))
    .orderBy(asc(milestones.dueDate));
  const dueDates = new Map(milestoneRows.map((row) => [row.id, row.dueDate]));
  const states = planDemoProgress(taskRows, dueDates, progress, today);
  for (const state of states) await writeTask(db, state, project.managerUserId);
  await recordActivity(db, project.id, states);
  const openMilestones = new Set(
    states
      .filter((state) => state.status !== 'done' && state.task.milestoneId !== null)
      .map((state) => state.task.milestoneId),
  );
  return milestoneRows
    .filter((row) => row.dueDate < today && !openMilestones.has(row.id))
    .map((row) => ({ id: row.id, version: row.version }));
}
