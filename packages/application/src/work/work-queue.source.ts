import type {
  ProjectCriticality,
  TaskDependencyEdge,
  TaskPriority,
  TaskStatus,
} from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';

/** One open task of the person, with the facts the ranking and workload need. */
export interface WorkQueueTaskRow {
  readonly taskId: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly dueDate: CalendarDate | null;
  readonly plannedStartDate: CalendarDate | null;
  readonly estimateMinutes: number | null;
  readonly actualMinutes: number;
  readonly projectCriticality: ProjectCriticality;
  readonly milestoneId: string | null;
  /** False when the person is a collaborator only. */
  readonly isOwner: boolean;
  readonly hasOpenBlocker: boolean;
  readonly needsAcknowledgement: boolean;
}

/**
 * Everything needed to rank one person's work: their open tasks plus the
 * dependency graph and milestones of the projects those tasks belong to.
 */
export interface WorkQueueSnapshot<TSummary> {
  readonly tasks: readonly { readonly row: WorkQueueTaskRow; readonly summary: TSummary }[];
  readonly edges: readonly TaskDependencyEdge[];
  readonly nodes: ReadonlyMap<
    string,
    { readonly status: TaskStatus; readonly milestoneId: string | null }
  >;
  readonly milestones: ReadonlyMap<
    string,
    { readonly name: string; readonly dueDate: CalendarDate; readonly isOpen: boolean }
  >;
}

/**
 * Read port for the work queue. `TSummary` is the read model's task summary
 * view; `today` (business timezone) lets summaries flag overdue work.
 */
export interface WorkQueueSource<TSummary> {
  snapshotFor(userId: string, today: CalendarDate): Promise<WorkQueueSnapshot<TSummary>>;
  reviewsWaitingFor(userId: string, today: CalendarDate): Promise<TSummary[]>;
  recentlyCompletedBy(
    userId: string,
    since: Date,
    limit: number,
    today: CalendarDate,
  ): Promise<TSummary[]>;
  person(userId: string): Promise<{ fullName: string; capacityPercent: number } | null>;
  /** Half-day units of approved leave on that date: 2 full day, 1 half day, null none. */
  approvedLeaveOn(userId: string, date: CalendarDate): Promise<1 | 2 | null>;
}
