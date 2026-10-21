import type {
  MilestoneStatus,
  ProjectStageStatus,
  ProjectWorkflowSnapshot,
  TaskPriority,
  TaskStatus,
} from '@lintel/domain';

export interface TemplateUpdateProject {
  readonly id: string;
  readonly name: string;
  readonly templateVersionId: string | null;
  readonly templateOptions: readonly string[];
  readonly plannedEndDate: string;
  readonly managerUserId: string;
  readonly version: number;
}

export interface NewStageRow {
  readonly templateKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly position: number;
  readonly status: 'pending' | 'active';
}

export interface StageRowChanges {
  readonly name?: string;
  readonly description?: string | null;
  readonly position?: number;
  readonly status?: ProjectStageStatus;
}

export interface NewMilestoneRow {
  readonly stageId: string;
  readonly templateKey: string;
  readonly name: string;
  readonly dueDate: string;
  readonly requiresClientApproval: boolean;
  readonly position: number;
}

export interface MilestoneRowChanges {
  readonly name?: string;
  readonly requiresClientApproval?: boolean;
  readonly stageId?: string | null;
  readonly status?: MilestoneStatus;
}

/** A task (or subtask) a template update adds, with everything resolved to IDs except new keys. */
export interface NewTemplateTaskRow {
  readonly key: string;
  readonly parentKey: string | null;
  readonly templateKey: string | null;
  readonly stageId: string | null;
  readonly milestoneId: string | null;
  readonly number: number;
  readonly title: string;
  readonly description: string | null;
  readonly status: 'draft' | 'ready';
  readonly priority: TaskPriority;
  readonly ownerUserId: string | null;
  readonly reviewerUserId: string | null;
  readonly plannedStartDate: string;
  readonly dueDate: string;
  readonly estimateMinutes: number | null;
  readonly requiresReview: boolean;
  readonly escalateAfterOverdueDays: number;
  readonly position: number;
  readonly checklist: readonly { readonly label: string; readonly isRequired: boolean }[];
  readonly deliverables: readonly {
    readonly name: string;
    readonly isRequired: boolean;
    readonly reviewerUserId: string | null;
  }[];
  /** Keys of other new tasks, and IDs of existing tasks, that must finish first. */
  readonly dependsOnKeys: readonly string[];
  readonly dependsOnTaskIds: readonly string[];
}

/** Columns a template update may write on an existing task. */
export interface TemplateTaskChanges {
  readonly title?: string;
  readonly description?: string | null;
  readonly priority?: TaskPriority;
  readonly requiresReview?: boolean;
  readonly estimateMinutes?: number | null;
  readonly escalateAfterOverdueDays?: number;
  readonly stageId?: string | null;
  readonly milestoneId?: string | null;
  readonly plannedStartDate?: string | null;
  readonly dueDate?: string | null;
  readonly status?: TaskStatus;
  readonly cancelledReason?: string | null;
}

/** What one update did, kept whole for the project's history. */
export interface TemplateUpdateSummary {
  readonly added: number;
  readonly changed: number;
  readonly cancelled: number;
  readonly heldBack: number;
  readonly ticked: readonly string[];
  readonly extendedPlannedEndTo: string | null;
  readonly items: readonly {
    readonly key: string;
    readonly change: 'added' | 'changed' | 'removed';
    readonly name: string;
    readonly applied: boolean;
  }[];
}

/** Reads a project's workflow and writes the parts of a template update. */
export interface TemplateUpdateStore {
  project(projectId: string): Promise<TemplateUpdateProject | null>;
  /** Locks the project row until the transaction ends. */
  projectForUpdate(projectId: string): Promise<TemplateUpdateProject | null>;
  snapshot(projectId: string): Promise<ProjectWorkflowSnapshot>;
  nextTaskNumber(projectId: string): Promise<number>;
  insertStage(projectId: string, stage: NewStageRow): Promise<string>;
  updateStage(stageId: string, changes: StageRowChanges): Promise<void>;
  /** Widens the stage's planned dates to cover new work (never narrows them). */
  extendStageDates(stageId: string, start: string, end: string): Promise<void>;
  insertMilestone(projectId: string, milestone: NewMilestoneRow): Promise<string>;
  updateMilestone(milestoneId: string, changes: MilestoneRowChanges): Promise<void>;
  /** Inserts tasks with their checklists, deliverables and dependencies. Returns IDs by key. */
  insertTasks(
    projectId: string,
    createdByUserId: string,
    tasks: readonly NewTemplateTaskRow[],
  ): Promise<Map<string, string>>;
  /** Writes the changes and bumps the task's version. */
  updateTask(taskId: string, changes: TemplateTaskChanges): Promise<void>;
  /** Removes unticked items with these labels; ticked ones stay as evidence. */
  removeOpenChecklistItems(taskId: string, labels: readonly string[]): Promise<void>;
  addDeliverables(
    projectId: string,
    taskId: string,
    deliverables: readonly { name: string; isRequired: boolean; reviewerUserId: string | null }[],
  ): Promise<void>;
  /** Cancels deliverables with these names that have no submitted version yet. */
  cancelUnsubmittedDeliverables(taskId: string, names: readonly string[]): Promise<void>;
  /** IDs of open, not-started subtasks of a task. */
  unstartedSubtaskIds(taskId: string): Promise<string[]>;
  /** True when the stage still has an open task. */
  stageHasOpenTasks(stageId: string): Promise<boolean>;
  /** Points the project at the new version (and optionally a later planned end); false when stale. */
  moveProject(
    projectId: string,
    expectedVersion: number,
    toVersionId: string,
    plannedEndDate: string | null,
  ): Promise<boolean>;
  recordUpdate(entry: {
    readonly projectId: string;
    readonly fromVersionId: string;
    readonly toVersionId: string;
    readonly appliedByUserId: string;
    readonly summary: TemplateUpdateSummary;
  }): Promise<void>;
}
