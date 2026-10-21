import {
  type Actor,
  DEFAULT_WORKING_CALENDAR,
  deadlineAwarePriorityStrategy,
  type PriorityClock,
  type TaskPriorityStrategy,
} from '@lintel/domain';
import { type CalendarDate, type Clock, timeOfDayInTimeZone } from '@lintel/shared';
import type { SettingsStore } from '../settings/settings.store';
import type { OperationsContext } from '../tasks/operations-context';
import {
  assembleWorkQueue,
  type WorkloadToday,
  type WorkQueueCounts,
  type WorkQueueItem,
  workloadToday,
} from './work-queue.assembler';
import type { WorkQueueSource } from './work-queue.source';

export interface WorkQueueResult<TSummary> {
  readonly today: CalendarDate;
  readonly next: WorkQueueItem<TSummary> | null;
  readonly items: WorkQueueItem<TSummary>[];
  readonly counts: WorkQueueCounts;
  readonly workload: WorkloadToday;
  readonly reviewsWaitingForMe: TSummary[];
  readonly recentlyCompleted: TSummary[];
  readonly strategy: string;
}

const RECENT_DAYS = 7;
const RECENT_LIMIT = 5;

/** The signed-in person's prioritised day: ranked queue, workload and reviews waiting on them. */
export class MyWorkQueueQuery<TSummary> {
  constructor(
    private readonly source: WorkQueueSource<TSummary>,
    private readonly settings: Pick<SettingsStore, 'calendarsForUsers'>,
    private readonly context: Pick<OperationsContext, 'today'>,
    private readonly clock: Clock,
    private readonly strategy: TaskPriorityStrategy = deadlineAwarePriorityStrategy,
  ) {}

  async execute(actor: Actor): Promise<WorkQueueResult<TSummary>> {
    const userId = actor.userId;
    const [today, calendars] = await Promise.all([
      this.context.today(),
      this.settings.calendarsForUsers([userId]),
    ]);
    const calendar = calendars.get(userId) ?? DEFAULT_WORKING_CALENDAR;
    const now = this.clock.now();
    // Due times are wall-clock times in the person's (the studio's) timezone.
    const clock: PriorityClock = {
      now: { date: today, time: timeOfDayInTimeZone(now, calendar.timeZone) },
      dayEndTime: calendar.dayEndTime,
    };
    const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000);
    const [snapshot, reviews, recent, person, leave] = await Promise.all([
      this.source.snapshotFor(userId, today, clock),
      this.source.reviewsWaitingFor(userId, today),
      this.source.recentlyCompletedBy(userId, since, RECENT_LIMIT, today),
      this.source.person(userId),
      this.source.approvedLeaveOn(userId, today),
    ]);
    const queue = assembleWorkQueue(snapshot, today, this.strategy, clock);
    const workload = workloadToday(
      {
        userId,
        fullName: person?.fullName ?? '',
        capacityPercent: person?.capacityPercent ?? 100,
        calendar,
      },
      snapshot.tasks.map((entry) => entry.row),
      leave,
      today,
    );
    return {
      today,
      ...queue,
      workload,
      reviewsWaitingForMe: reviews,
      recentlyCompleted: recent,
      strategy: this.strategy.name,
    };
  }
}
