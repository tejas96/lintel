import {
  type CapacityTaskLoad,
  calculatePersonCapacity,
  DEFAULT_TASK_ESTIMATE_MINUTES,
  directDependentCount,
  downstreamTasks,
  isOpenTaskStatus,
  type LoadStatus,
  type PrioritizationInput,
  type PriorityClock,
  type PriorityReason,
  rankWorkQueue,
  type TaskPriorityStrategy,
  unmetPrerequisites,
  type WorkingCalendar,
  type WorkQueueBucket,
} from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import { isFinishedTaskStatus } from '../tasks/task-decision';
import type { WorkQueueSnapshot, WorkQueueTaskRow } from './work-queue.source';

export interface WorkQueueItem<TSummary> {
  readonly task: TSummary;
  readonly score: number;
  readonly bucket: WorkQueueBucket;
  readonly headline: string;
  readonly reasons: readonly PriorityReason[];
}

export interface WorkQueueCounts {
  readonly overdue: number;
  readonly today: number;
  readonly upcoming: number;
  readonly blocked: number;
  readonly waiting: number;
  readonly inReview: number;
  readonly needsAcknowledgement: number;
}

export interface WorkloadToday {
  readonly availableMinutesToday: number;
  readonly committedMinutesToday: number;
  readonly status: LoadStatus;
  readonly onLeaveToday: boolean;
}

const ACTIONABLE: ReadonlySet<WorkQueueBucket> = new Set(['overdue', 'today', 'upcoming', 'later']);

function earliestOpenMilestone<T>(
  row: WorkQueueTaskRow,
  snapshot: WorkQueueSnapshot<T>,
): { name: string; dueDate: CalendarDate } | null {
  const candidates = [
    row.milestoneId,
    ...downstreamTasks(row.taskId, snapshot.edges).map(
      (id) => snapshot.nodes.get(id)?.milestoneId ?? null,
    ),
  ];
  let earliest: { name: string; dueDate: CalendarDate } | null = null;
  for (const id of candidates) {
    const milestone = id ? snapshot.milestones.get(id) : undefined;
    if (!milestone?.isOpen) continue;
    if (!earliest || milestone.dueDate < earliest.dueDate) earliest = milestone;
  }
  return earliest;
}

/** Turns the snapshot into the domain's prioritisation inputs, one per task. */
export function prioritizationInputs<T>(snapshot: WorkQueueSnapshot<T>): PrioritizationInput[] {
  const openEdges = snapshot.edges.filter((edge) => {
    const status = snapshot.nodes.get(edge.taskId)?.status;
    return status !== undefined && isOpenTaskStatus(status);
  });
  const isFinished = (id: string) => {
    const status = snapshot.nodes.get(id)?.status;
    return status !== undefined && isFinishedTaskStatus(status);
  };
  return snapshot.tasks.map(({ row }) => {
    const milestone = earliestOpenMilestone(row, snapshot);
    return {
      taskId: row.taskId,
      title: row.title,
      status: row.status,
      priority: row.priority,
      dueDate: row.dueDate,
      dueTime: row.dueTime,
      estimateMinutes: row.estimateMinutes,
      projectCriticality: row.projectCriticality,
      openDependentCount: directDependentCount(row.taskId, openEdges),
      milestoneDueDate: milestone?.dueDate ?? null,
      milestoneName: milestone?.name ?? null,
      hasUnmetPrerequisites: unmetPrerequisites(row.taskId, snapshot.edges, isFinished).length > 0,
      isBlocked: row.status === 'blocked' || row.hasOpenBlocker,
    };
  });
}

/** Ranks the person's tasks and picks the next actionable one. */
export function assembleWorkQueue<T>(
  snapshot: WorkQueueSnapshot<T>,
  today: CalendarDate,
  strategy: TaskPriorityStrategy,
  clock?: PriorityClock,
): { items: WorkQueueItem<T>[]; next: WorkQueueItem<T> | null; counts: WorkQueueCounts } {
  const summaries = new Map(snapshot.tasks.map((entry) => [entry.row.taskId, entry.summary]));
  const items: WorkQueueItem<T>[] = [];
  for (const ranked of rankWorkQueue(prioritizationInputs(snapshot), today, strategy, clock)) {
    const task = summaries.get(ranked.taskId);
    if (task === undefined) continue;
    const { score, bucket, headline, reasons } = ranked;
    items.push({ task, score, bucket, headline, reasons });
  }
  const count = (bucket: WorkQueueBucket) => items.filter((item) => item.bucket === bucket).length;
  return {
    items,
    next: items.find((item) => ACTIONABLE.has(item.bucket)) ?? null,
    counts: {
      overdue: count('overdue'),
      today: count('today'),
      upcoming: count('upcoming'),
      blocked: count('blocked'),
      waiting: count('waiting'),
      inReview: count('in_review'),
      needsAcknowledgement: snapshot.tasks.filter(
        ({ row }) => row.isOwner && row.needsAcknowledgement,
      ).length,
    },
  };
}

/** Remaining effort: estimate (or the default) minus time already logged, never below zero. */
export function remainingMinutes(row: WorkQueueTaskRow): number {
  return Math.max(0, (row.estimateMinutes ?? DEFAULT_TASK_ESTIMATE_MINUTES) - row.actualMinutes);
}

/** Today's load for the person, from the domain capacity calculator. Owned work only. */
export function workloadToday(
  person: {
    userId: string;
    fullName: string;
    capacityPercent: number;
    calendar: WorkingCalendar;
  },
  rows: readonly WorkQueueTaskRow[],
  leaveHalfDays: 1 | 2 | null,
  today: CalendarDate,
): WorkloadToday {
  const loads: CapacityTaskLoad[] = rows
    .filter((row) => row.isOwner && row.status !== 'in_review')
    .map((row) => ({
      taskId: row.taskId,
      userId: person.userId,
      remainingMinutes: remainingMinutes(row),
      estimateIsDefault: row.estimateMinutes === null,
      startDate: row.plannedStartDate,
      dueDate: row.dueDate,
      commitment: row.status === 'draft' ? 'tentative' : 'confirmed',
      isBlocked: row.status === 'blocked' || row.hasOpenBlocker,
    }));
  const leave =
    leaveHalfDays === null
      ? []
      : [
          {
            userId: person.userId,
            date: today,
            halfDayUnits: leaveHalfDays,
            status: 'approved' as const,
          },
        ];
  const capacity = calculatePersonCapacity(
    person,
    { start: today, end: today },
    today,
    leave,
    loads,
  );
  const day = capacity.days[0];
  return {
    availableMinutesToday: day?.availableMinutes ?? 0,
    committedMinutesToday: day?.confirmedMinutes ?? 0,
    status: day?.status ?? 'available',
    onLeaveToday: leaveHalfDays !== null,
  };
}
