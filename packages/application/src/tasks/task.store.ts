import type {
  DeliverableStatus,
  TaskDependencyEdge,
  TaskPriority,
  TaskStatus,
} from '@lintel/domain';

/** The write-side view of one task row. Dates are calendar dates ("YYYY-MM-DD"). */
export interface TaskRecord {
  readonly id: string;
  readonly projectId: string;
  readonly stageId: string | null;
  readonly milestoneId: string | null;
  readonly parentTaskId: string | null;
  readonly number: number;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly ownerUserId: string | null;
  readonly reviewerUserId: string | null;
  readonly plannedStartDate: string | null;
  readonly dueDate: string | null;
  readonly baselineDueDate: string | null;
  readonly estimateMinutes: number | null;
  readonly actualMinutes: number;
  readonly requiresReview: boolean;
  readonly acknowledgedAt: Date | null;
  readonly completionCriteria: string | null;
  readonly reviewRounds: number;
  readonly startedAt: Date | null;
  readonly submittedAt: Date | null;
  readonly completedAt: Date | null;
  readonly completedByUserId: string | null;
  readonly cancelledReason: string | null;
  readonly version: number;
}

/** Columns a command may change. `version` and `actualMinutes` are managed by the store. */
export type TaskChanges = Partial<
  Omit<TaskRecord, 'id' | 'projectId' | 'number' | 'version' | 'actualMinutes'>
>;

export interface NewTask {
  readonly projectId: string;
  readonly stageId: string | null;
  readonly milestoneId: string | null;
  readonly parentTaskId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly ownerUserId: string | null;
  readonly reviewerUserId: string | null;
  readonly plannedStartDate: string | null;
  readonly dueDate: string | null;
  readonly baselineDueDate: string | null;
  readonly estimateMinutes: number | null;
  readonly requiresReview: boolean;
  readonly completionCriteria: string | null;
  readonly createdByUserId: string;
}

/** Raw facts the transition rules need, loaded in one place. */
export interface TaskDecisionInputs {
  readonly collaboratorUserIds: readonly string[];
  /** Edges where this task is the dependent ("this task depends on …"). */
  readonly prerequisiteEdges: readonly TaskDependencyEdge[];
  readonly prerequisites: readonly {
    readonly id: string;
    readonly title: string;
    readonly status: TaskStatus;
  }[];
  readonly checklist: readonly { readonly isRequired: boolean; readonly completed: boolean }[];
  readonly deliverables: readonly {
    readonly name: string;
    readonly isRequired: boolean;
    readonly status: DeliverableStatus;
    readonly currentVersionNumber: number;
  }[];
  readonly openBlockerCount: number;
}

export interface ProjectTaskNode {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly ownerUserId: string | null;
}

export interface ScheduleChangeInput {
  readonly taskId: string;
  readonly previousDueDate: string | null;
  readonly newDueDate: string | null;
  readonly reason: string;
  readonly changedByUserId: string;
}

export interface ProjectReferences {
  readonly stageId?: string | null | undefined;
  readonly milestoneId?: string | null | undefined;
  readonly taskId?: string | null | undefined;
}

/** Write-side persistence for tasks, their collaborators, dependencies and schedule history. */
export interface TaskStore {
  find(taskId: string): Promise<TaskRecord | null>;
  /** Locks the task row until the transaction ends. */
  findForUpdate(taskId: string): Promise<TaskRecord | null>;
  decisionInputs(taskId: string): Promise<TaskDecisionInputs>;
  /** Inserts the task with the next per-project number (locks the project row). */
  create(task: NewTask): Promise<TaskRecord>;
  /** Applies the change only if `expectedVersion` still matches. Returns null on a stale version. */
  update(taskId: string, expectedVersion: number, changes: TaskChanges): Promise<TaskRecord | null>;
  /** Atomic increment used by work-session accounting; does not bump the version. */
  addActualMinutes(taskId: string, minutes: number): Promise<void>;
  collaboratorIds(taskId: string): Promise<string[]>;
  replaceCollaborators(taskId: string, userIds: readonly string[]): Promise<void>;
  /** Serialises structural changes (numbers, dependencies) within one project. */
  lockProject(projectId: string): Promise<void>;
  dependencyGraph(
    projectId: string,
  ): Promise<{ edges: TaskDependencyEdge[]; nodes: ProjectTaskNode[] }>;
  /** Returns false when the edge already existed. */
  addDependency(edge: TaskDependencyEdge, createdByUserId: string): Promise<boolean>;
  /** Returns false when there was no such edge. */
  removeDependency(edge: TaskDependencyEdge): Promise<boolean>;
  recordScheduleChange(change: ScheduleChangeInput): Promise<void>;
  attachFile(taskId: string, fileId: string): Promise<void>;
  /** Which of the given references exist inside the project. */
  referencesInProject(
    projectId: string,
    references: ProjectReferences,
  ): Promise<{ stage: boolean; milestone: boolean; task: boolean }>;
  /** IDs (from the given list) of people whose account is active. */
  activeUserIds(userIds: readonly string[]): Promise<Set<string>>;
  /** Adds the person as a project "member" unless they already belong. Returns true when added. */
  ensureProjectMember(projectId: string, userId: string): Promise<boolean>;
}
