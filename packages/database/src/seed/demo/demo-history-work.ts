import { DEFAULT_TASK_ESTIMATE_MINUTES, workingDaysInRange } from '@lintel/domain';
import { type CalendarDate, toCalendarDate } from '@lintel/shared';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import type { Database } from '../../client';
import { tasks, workSessions } from '../../schema';
import type { HistoryProject } from './demo-history-projects';
import { clockTime, type HistoryClock, plusMinutes, stableHash } from './demo-history-time';

/** Logged work sits between 10:30 and 17:30, inside the task's start and completion times. */
const DAY_START = 10 * 60 + 30;
const DAY_END = 17 * 60 + 30;
const BREAK_MINUTES = 15;
const SHORTEST_SESSION = 30;
const COMFORTABLE_SESSION = 360;

/** Minutes a task would like to log on one of its owner's days. */
interface DayDemand {
  readonly taskId: string;
  readonly userId: string;
  readonly day: CalendarDate;
  readonly minutes: number;
}

interface NewSession {
  readonly taskId: string;
  readonly userId: string;
  readonly startedAt: Date;
  readonly endedAt: Date;
}

const minutesOf = (session: NewSession) =>
  (session.endedAt.getTime() - session.startedAt.getTime()) / 60_000;

function spread<T>(items: readonly T[], count: number): T[] {
  return Array.from(
    { length: count },
    (_, index) => items[Math.floor(((index + 1) * items.length) / count) - 1],
  ).filter((item): item is T => item !== undefined);
}

type TaskRow = Awaited<ReturnType<typeof loadStartedTasks>>[number];

async function loadStartedTasks(db: Database, projectIds: readonly string[]) {
  return db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      number: tasks.number,
      status: tasks.status,
      ownerUserId: tasks.ownerUserId,
      plannedStartDate: tasks.plannedStartDate,
      estimateMinutes: tasks.estimateMinutes,
      completedAt: tasks.completedAt,
    })
    .from(tasks)
    .where(
      and(
        inArray(tasks.projectId, [...projectIds]),
        inArray(tasks.status, ['done', 'in_progress', 'in_review', 'blocked']),
        isNotNull(tasks.ownerUserId),
        isNotNull(tasks.plannedStartDate),
      ),
    )
    .orderBy(asc(tasks.plannedStartDate), asc(tasks.number));
}

/**
 * Finished work wants its estimate (120 minutes without one) times
 * 0.8–1.25 over 1–3 (or more, for long tasks) of the owner's working days
 * between the planned start and the completion day; work still under way
 * wants 25–45 % of it on its most recent days. Approved leave is skipped.
 */
function demandsOf(
  row: TaskRow,
  projectName: string,
  clock: HistoryClock,
  daysOff: ReadonlySet<string>,
): DayDemand[] {
  if (!row.ownerUserId || !row.plannedStartDate) return [];
  const userId = row.ownerUserId;
  const finished = row.status === 'done';
  if (finished && !row.completedAt) return [];
  const last = row.completedAt ? clock.dateOf(row.completedAt) : clock.shift(clock.today, -1);
  const first = toCalendarDate(row.plannedStartDate);
  if (first > last) return [];
  const days = workingDaysInRange(clock.calendar, first, last).filter((day) => !daysOff.has(day));
  const roll = stableHash(`${projectName}#${row.number}/work`);
  const estimate = row.estimateMinutes ?? DEFAULT_TASK_ESTIMATE_MINUTES;
  const target = estimate * (finished ? 0.8 + (roll % 46) / 100 : 0.25 + (roll % 21) / 100);
  const preferred = finished ? 1 + (roll % 3) : 1;
  const count = Math.min(days.length, Math.max(preferred, Math.ceil(target / COMFORTABLE_SESSION)));
  const chosen = finished ? spread(days, count) : days.slice(-count);
  return chosen.map((day) => ({ taskId: row.id, userId, day, minutes: target / chosen.length }));
}

/**
 * One person's day, session after session with a short break between. When
 * the plan asks for more than the day holds, every task gets its share of it:
 * nobody logs two things at once or works past 17:30.
 */
function layOutDay(demands: readonly DayDemand[], clock: HistoryClock): NewSession[] {
  const first = demands[0];
  if (!first) return [];
  const start = DAY_START + (stableHash(`${first.userId}@${first.day}`) % 4) * 5;
  const capacity = DAY_END - start - BREAK_MINUTES * (demands.length - 1);
  const wanted = demands.reduce((total, demand) => total + demand.minutes, 0);
  const scale = Math.min(1, capacity / wanted);
  let cursor = start;
  const sessions: NewSession[] = [];
  for (const demand of demands) {
    const minutes = Math.floor(demand.minutes * scale);
    if (minutes < SHORTEST_SESSION) continue;
    const startedAt = clock.at(demand.day, clockTime(cursor));
    sessions.push({
      taskId: demand.taskId,
      userId: demand.userId,
      startedAt,
      endedAt: plusMinutes(startedAt, minutes),
    });
    cursor += minutes + BREAK_MINUTES;
  }
  return sessions;
}

/** Ended work sessions for started and finished tasks; never a running one. */
export async function seedWorkSessions(
  db: Database,
  clock: HistoryClock,
  scope: readonly HistoryProject[],
  daysOff: ReadonlyMap<string, ReadonlySet<string>>,
): Promise<{ sessions: number; minutes: number }> {
  const names = new Map(scope.map((project) => [project.id, project.name]));
  const rows = await loadStartedTasks(db, [...names.keys()]);
  const byPersonDay = new Map<string, DayDemand[]>();
  for (const row of rows) {
    const off = daysOff.get(row.ownerUserId ?? '') ?? new Set<string>();
    for (const demand of demandsOf(row, names.get(row.projectId) ?? '', clock, off)) {
      const key = `${demand.userId}@${demand.day}`;
      byPersonDay.set(key, [...(byPersonDay.get(key) ?? []), demand]);
    }
  }
  const sessions = [...byPersonDay.values()].flatMap((demands) => layOutDay(demands, clock));
  const perTask = new Map<string, number>();
  for (const session of sessions) {
    perTask.set(session.taskId, (perTask.get(session.taskId) ?? 0) + minutesOf(session));
  }
  for (const [taskId, minutes] of perTask) {
    await db
      .update(tasks)
      .set({ actualMinutes: Math.round(minutes) })
      .where(eq(tasks.id, taskId));
  }
  for (let index = 0; index < sessions.length; index += 500) {
    await db.insert(workSessions).values(sessions.slice(index, index + 500));
  }
  const total = sessions.reduce((sum, session) => sum + minutesOf(session), 0);
  return { sessions: sessions.length, minutes: Math.round(total) };
}
