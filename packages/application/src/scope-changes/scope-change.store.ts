import type { Capability, MilestoneStatus, TaskDependencyEdge, TaskStatus } from '@lintel/domain';

export interface ScheduleTaskFact {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly plannedStartDate: string | null;
  readonly dueDate: string | null;
  readonly ownerUserId: string | null;
  readonly milestoneId: string | null;
}

/** Everything needed to work out how a schedule change ripples through a project. */
export interface ProjectScheduleFacts {
  readonly projectId: string;
  readonly name: string;
  readonly plannedEndDate: string;
  readonly tasks: readonly ScheduleTaskFact[];
  readonly dependencies: readonly TaskDependencyEdge[];
  readonly milestones: readonly {
    readonly id: string;
    readonly dueDate: string;
    readonly status: MilestoneStatus;
  }[];
}

export interface ScopeChangeImpact {
  readonly taskId: string;
  readonly taskTitle: string;
  readonly currentDueDate: string | null;
  readonly proposedDueDate: string | null;
  readonly shiftWorkingDays: number;
  readonly isDownstream: boolean;
}

export interface StoredScopeChangeImpact extends ScopeChangeImpact {
  readonly id: string;
}

export type ScopeChangeStatus = 'proposed' | 'approved' | 'rejected' | 'withdrawn';

export interface ScopeChangeRecord {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly description: string;
  readonly status: ScopeChangeStatus;
  readonly requestedByUserId: string;
  readonly version: number;
}

export interface NewScopeChange {
  readonly projectId: string;
  readonly title: string;
  readonly description: string;
  readonly requestedByUserId: string;
  readonly impacts: readonly ScopeChangeImpact[];
  readonly projectEndImpactDays: number;
}

export interface ScopeChangeDecision {
  readonly status: 'approved' | 'rejected';
  readonly decidedByUserId: string;
  readonly decidedAt: Date;
  readonly note: string;
}

/** A due-date move: the task's dates change and the move is kept in its schedule history. */
export interface TaskReschedule {
  readonly taskId: string;
  readonly previousDueDate: string | null;
  readonly plannedStartDate: string | null;
  readonly dueDate: string | null;
  readonly reason: string;
  readonly scopeChangeId: string;
  readonly changedByUserId: string;
}

/** Write-side persistence for scope change requests and the schedule moves they approve. */
export interface ScopeChangeStore {
  scheduleFacts(projectId: string): Promise<ProjectScheduleFacts | null>;
  insert(change: NewScopeChange): Promise<{ id: string }>;
  findById(scopeChangeId: string): Promise<ScopeChangeRecord | null>;
  impactsOf(scopeChangeId: string): Promise<StoredScopeChangeImpact[]>;
  /** Null-safe optimistic update: false when the version no longer matches or it was decided. */
  decide(
    scopeChangeId: string,
    expectedVersion: number,
    decision: ScopeChangeDecision,
  ): Promise<boolean>;
  /** Records the dates actually applied when the task moved since the proposal. */
  correctImpact(
    impactId: string,
    currentDueDate: string | null,
    proposedDueDate: string | null,
  ): Promise<void>;
  /** Moves planned start and due date (never the baseline) and appends schedule history. */
  rescheduleTask(change: TaskReschedule): Promise<void>;
  moveMilestoneDueDate(milestoneId: string, dueDate: string): Promise<void>;
  extendProjectEnd(projectId: string, plannedEndDate: string): Promise<void>;
  /** Active people whose role currently grants the capability. */
  userIdsWithCapability(capability: Capability): Promise<string[]>;
}
