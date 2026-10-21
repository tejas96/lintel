import { isWorkingDay, nextWorkingDayOnOrAfter } from '@lintel/domain';
import { addDays, type CalendarDate, toCalendarDate } from '@lintel/shared';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import type { Database } from '../../client';
import { activityEvents, taskChecklistItems, tasks } from '../../schema';
import type { HistoryProject } from './demo-history-projects';
import { type HistoryClock, stableHash } from './demo-history-time';

/** Everyday completions land at 17:30 in the studio's timezone, like the progress writer. */
export const COMPLETION_TIME = '17:30';

export interface DoneTaskFact {
  readonly id: string;
  readonly projectName: string;
  readonly number: number;
  readonly ownerUserId: string | null;
  readonly plannedStartDate: string | null;
  readonly dueDate: string;
}

export type DeliveryTiming = 'late' | 'early' | 'on_time';

/** Late by `days` calendar days, nudged to a working day without leaving 1–4 days late. */
function lateDay(clock: HistoryClock, due: CalendarDate, days: number): CalendarDate {
  const candidate = addDays(due, days);
  if (isWorkingDay(clock.calendar, candidate)) return candidate;
  const dayBefore = addDays(candidate, -1);
  if (dayBefore > due && isWorkingDay(clock.calendar, dayBefore)) return dayBefore;
  return nextWorkingDayOnOrAfter(clock.calendar, candidate);
}

interface PlannedCompletion {
  readonly day: CalendarDate;
  readonly timing: DeliveryTiming;
}

/** About 25 % late by 1–4 days, about 10 % a working day early, the rest on time (null). */
function proposedCompletion(fact: DoneTaskFact, clock: HistoryClock): PlannedCompletion | null {
  const due = toCalendarDate(fact.dueDate);
  const roll = stableHash(`${fact.projectName}#${fact.number}`) % 100;
  if (roll < 25) return { day: lateDay(clock, due, 1 + (roll % 4)), timing: 'late' };
  if (roll >= 35) return null;
  const day = clock.shift(due, -1);
  const startedBefore = fact.plannedStartDate !== null && day >= fact.plannedStartDate;
  return startedBefore ? { day, timing: 'early' } : null;
}

/**
 * Only work due more than a week ago moves. Within the current month each
 * owner is late at most once, so this month's reward run still has people
 * who qualify.
 */
export function planCompletionDays(
  facts: readonly DoneTaskFact[],
  clock: HistoryClock,
): Map<string, PlannedCompletion> {
  const cutoff = addDays(clock.today, -7);
  const month = clock.today.slice(0, 7);
  const lateThisMonth = new Set<string>();
  const plan = new Map<string, PlannedCompletion>();
  for (const fact of facts) {
    if (fact.dueDate >= cutoff) continue;
    const proposed = proposedCompletion(fact, clock);
    if (!proposed) continue;
    if (proposed.timing === 'late' && proposed.day.startsWith(month)) {
      const owner = fact.ownerUserId ?? 'unowned';
      if (lateThisMonth.has(owner)) continue;
      lateThisMonth.add(owner);
    }
    plan.set(fact.id, proposed);
  }
  return plan;
}

/**
 * Moves done tasks off their due date where the plan says so, together with
 * their ticked checklist items and the "completed" feed entry.
 */
export async function retimeDoneTasks(
  db: Database,
  clock: HistoryClock,
  scope: readonly HistoryProject[],
): Promise<{ late: number; early: number }> {
  const names = new Map(scope.map((project) => [project.id, project.name]));
  const rows = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      number: tasks.number,
      ownerUserId: tasks.ownerUserId,
      plannedStartDate: tasks.plannedStartDate,
      dueDate: tasks.dueDate,
    })
    .from(tasks)
    .where(
      and(
        inArray(tasks.projectId, [...names.keys()]),
        eq(tasks.status, 'done'),
        isNotNull(tasks.dueDate),
      ),
    )
    .orderBy(asc(tasks.dueDate), asc(tasks.number));
  const facts = rows.flatMap((row): DoneTaskFact[] =>
    row.dueDate
      ? [{ ...row, dueDate: row.dueDate, projectName: names.get(row.projectId) ?? '' }]
      : [],
  );
  const plan = planCompletionDays(facts, clock);
  let late = 0;
  for (const [taskId, { day, timing }] of plan) {
    const completedAt = clock.past(clock.at(day, COMPLETION_TIME));
    await db.update(tasks).set({ completedAt }).where(eq(tasks.id, taskId));
    await db
      .update(taskChecklistItems)
      .set({ completedAt })
      .where(and(eq(taskChecklistItems.taskId, taskId), isNotNull(taskChecklistItems.completedAt)));
    await db
      .update(activityEvents)
      .set({ createdAt: completedAt })
      .where(and(eq(activityEvents.taskId, taskId), eq(activityEvents.type, 'task.completed')));
    if (timing === 'late') late += 1;
  }
  return { late, early: plan.size - late };
}
