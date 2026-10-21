import type { WorkingCalendar } from '../calendar/working-calendar';
import type { MilestoneStatus } from '../projects/milestone-risk';
import type { TaskPriority, TaskStatus } from '../tasks/task-status';
import type { WorkflowTemplateDefinition } from '../workflows/workflow-template-definition';

export type ProjectStageStatus = 'pending' | 'active' | 'completed' | 'skipped';

/** A project's workflow as it stands today, as far as a template update cares. */
export interface SnapshotStage {
  readonly id: string;
  readonly templateKey: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly status: ProjectStageStatus;
  readonly position: number;
}

export interface SnapshotMilestone {
  readonly id: string;
  readonly templateKey: string | null;
  readonly stageId: string | null;
  readonly name: string;
  readonly status: MilestoneStatus;
  readonly requiresClientApproval: boolean;
}

export interface SnapshotTask {
  readonly id: string;
  readonly templateKey: string | null;
  readonly parentTaskId: string | null;
  readonly stageId: string | null;
  readonly milestoneId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly requiresReview: boolean;
  readonly estimateMinutes: number | null;
  readonly escalateAfterOverdueDays: number;
  readonly plannedStartDate: string | null;
  readonly dueDate: string | null;
  /** Set once the due date is a commitment (the task was published). */
  readonly baselineDueDate: string | null;
  readonly checklistLabels: readonly string[];
  /** Names of deliverables that are not cancelled. */
  readonly deliverableNames: readonly string[];
  readonly prerequisiteTaskIds: readonly string[];
}

export interface ProjectWorkflowSnapshot {
  readonly templateOptions: readonly string[];
  readonly stages: readonly SnapshotStage[];
  readonly milestones: readonly SnapshotMilestone[];
  readonly tasks: readonly SnapshotTask[];
}

export interface TemplateUpdateInput {
  readonly project: ProjectWorkflowSnapshot;
  /** The version the project follows now. */
  readonly from: WorkflowTemplateDefinition;
  /** The newer published version. */
  readonly to: WorkflowTemplateDefinition;
  readonly calendar: WorkingCalendar;
}

export type TemplateItemKind = 'stage' | 'milestone' | 'task';
export type TemplateChangeKind = 'added' | 'changed' | 'removed';

export type TemplateField =
  | 'name'
  | 'description'
  | 'title'
  | 'priority'
  | 'requiresReview'
  | 'estimateMinutes'
  | 'escalateAfterOverdueDays'
  | 'requiresClientApproval'
  | 'stage'
  | 'milestone'
  | 'duration'
  | 'checklist'
  | 'prerequisites'
  | 'deliverables';

/**
 * apply: changes by default. held: changes only when the manager ticks the
 * item. kept: this project already changed the field itself, so its own
 * version stays.
 */
export type FieldOutcome = 'apply' | 'held' | 'kept';

export interface TemplateFieldChange {
  readonly field: TemplateField;
  /** Value fields: the project's current value and the template's new one. */
  readonly from: string | null;
  readonly to: string | null;
  /** List fields (checklist, prerequisites, deliverables): what comes and goes. */
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly outcome: FieldOutcome;
}

export interface DateMove {
  readonly fromStart: string | null;
  readonly fromDue: string | null;
  readonly toStart: string | null;
  readonly toDue: string | null;
}

export interface TemplateItemChange {
  /** Unique within the update, e.g. "task:site-measurement". The manager ticks items by key. */
  readonly key: string;
  readonly kind: TemplateItemKind;
  readonly change: TemplateChangeKind;
  readonly templateKey: string;
  /** The project row it concerns; null for added items. */
  readonly itemId: string | null;
  readonly name: string;
  /** Template key of the stage it belongs to (stages: their own key). */
  readonly stageKey: string | null;
  /** The project item's current status; null for added items. */
  readonly status: string | null;
  readonly fields: readonly TemplateFieldChange[];
  /** For changed tasks whose duration moves: the dates before and after. */
  readonly dates: DateMove | null;
  /** Ticking the item applies its held parts; says what ticking means. */
  readonly optIn: { readonly reason: string } | null;
  /** Never applied, whatever is ticked; says why. */
  readonly blocked: { readonly reason: string } | null;
}

export interface TemplateUpdatePlan {
  readonly items: readonly TemplateItemChange[];
  readonly unchanged: {
    readonly stages: number;
    readonly milestones: number;
    readonly tasks: number;
  };
}

export function templateItemKey(kind: TemplateItemKind, templateKey: string): string {
  return `${kind}:${templateKey}`;
}

/** Statuses in which somebody has started (or finished) the work. */
export const STARTED_TASK_STATUSES: readonly TaskStatus[] = [
  'in_progress',
  'blocked',
  'in_review',
  'changes_requested',
];

export function isNotStartedTask(status: TaskStatus): boolean {
  return status === 'draft' || status === 'ready';
}
