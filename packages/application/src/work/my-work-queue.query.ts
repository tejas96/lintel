import {
  type Actor,
  DEFAULT_WORKING_CALENDAR,
  deadlineAwarePriorityStrategy,
  type TaskPriorityStrategy,
} from '@lintel/domain';
import type { CalendarDate, Clock } from '@lintel/shared';
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
    const today = await this.context.today();
    const since = new Date(this.clock.now().getTime() - RECENT_DAYS * 86_400_000);
    const [snapshot, reviews, recent, person, leave, calendars] = await Promise.all([
      this.source.snapshotFor(userId, today),
      this.source.reviewsWaitingFor(userId, today),
      this.source.recentlyCompletedBy(userId, since, RECENT_LIMIT, today),
      this.source.person(userId),
      this.source.approvedLeaveOn(userId, today),
      this.settings.calendarsForUsers([userId]),
    ]);
    const queue = assembleWorkQueue(snapshot, today, this.strategy);
    const workload = workloadToday(
      {
        userId,
        fullName: person?.fullName ?? '',
        capacityPercent: person?.capacityPercent ?? 100,
        calendar: calendars.get(userId) ?? DEFAULT_WORKING_CALENDAR,
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
