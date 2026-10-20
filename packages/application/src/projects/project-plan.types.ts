import type { TaskPriority } from '@lintel/domain';

/**
 * A fully resolved project plan, ready to be written. Records refer to each
 * other by plan keys (template keys, or `<task>#<n>` for subtasks); the store
 * turns keys into database IDs while inserting.
 */
export interface NewStage {
  readonly key: string;
  readonly templateKey: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly position: number;
  readonly status: 'active' | 'pending';
  readonly plannedStartDate: string | null;
  readonly plannedEndDate: string | null;
}

export interface NewMilestone {
  readonly key: string;
  readonly stageKey: string;
  readonly name: string;
  readonly dueDate: string;
  readonly requiresClientApproval: boolean;
  readonly position: number;
}

export interface NewChecklistItem {
  readonly label: string;
  readonly isRequired: boolean;
}

export interface PlannedProjectTask {
  readonly key: string;
  readonly parentKey: string | null;
  readonly stageKey: string | null;
  readonly milestoneKey: string | null;
  readonly templateKey: string | null;
  readonly number: number;
  readonly title: string;
  readonly description: string | null;
  readonly status: 'draft' | 'ready';
  readonly priority: TaskPriority;
  readonly ownerUserId: string | null;
  readonly reviewerUserId: string | null;
  readonly plannedStartDate: string | null;
  readonly dueDate: string | null;
  readonly estimateMinutes: number | null;
  readonly requiresReview: boolean;
  readonly escalateAfterOverdueDays: number;
  readonly position: number;
  readonly checklist: readonly NewChecklistItem[];
  /** Keys of tasks that must finish first. */
  readonly dependsOn: readonly string[];
}

export interface PlannedProjectDeliverable {
  readonly taskKey: string;
  readonly name: string;
  readonly isRequired: boolean;
  readonly reviewerUserId: string | null;
}

export interface NewProjectPlan {
  readonly stages: readonly NewStage[];
  readonly milestones: readonly NewMilestone[];
  readonly tasks: readonly PlannedProjectTask[];
  readonly deliverables: readonly PlannedProjectDeliverable[];
}
