import type { ProjectRole } from '../identity/roles';
import type { TaskPriority } from '../tasks/task-status';

/**
 * A published template version stores one of these documents. Keys are
 * stable identifiers inside the template ("site-measurement"); dependencies
 * and milestones refer to keys, never to database IDs.
 */
export interface WorkflowTemplateDefinition {
  /** Switches a project can turn on when it is created, e.g. "includes_execution". */
  readonly options: readonly TemplateOption[];
  readonly stages: readonly TemplateStage[];
}

export interface TemplateOption {
  readonly key: string;
  readonly label: string;
  readonly enabledByDefault: boolean;
}

export interface TemplateStage {
  readonly key: string;
  readonly name: string;
  readonly description?: string;
  /** Only include this stage when the project sets every listed option. */
  readonly requiresOptions?: readonly string[];
  readonly milestones: readonly TemplateMilestone[];
  readonly tasks: readonly TemplateTask[];
}

export interface TemplateMilestone {
  readonly key: string;
  readonly name: string;
  readonly requiresClientApproval: boolean;
}

export interface TemplateChecklistItem {
  readonly label: string;
  readonly required: boolean;
}

export interface TemplateDeliverable {
  readonly name: string;
  readonly required: boolean;
}

export interface TemplateTask {
  readonly key: string;
  readonly title: string;
  readonly description?: string;
  readonly milestoneKey?: string;
  readonly responsibleRole: ProjectRole;
  /** Working days the task normally takes. At least 1. */
  readonly durationDays: number;
  readonly estimateMinutes?: number;
  readonly dependsOn: readonly string[];
  readonly priority: TaskPriority;
  readonly requiresReview: boolean;
  readonly reviewerRole?: ProjectRole;
  readonly checklist: readonly TemplateChecklistItem[];
  readonly deliverables: readonly TemplateDeliverable[];
  /** Working days overdue before the project manager is alerted. */
  readonly escalateAfterOverdueDays?: number;
  readonly subtasks?: readonly TemplateSubtask[];
}

export interface TemplateSubtask {
  readonly title: string;
  readonly estimateMinutes?: number;
}

export interface TemplateValidationIssue {
  readonly path: string;
  readonly message: string;
}
