import type { ProjectCriticality, Role, TaskPriority, TaskStatus } from '@lintel/domain';

/**
 * Read-model records. They are JSON-ready (ISO strings for instants,
 * "YYYY-MM-DD" for calendar dates) and match the API contract shapes, so
 * API presenters can return them without reshaping.
 */
export interface UserSummaryView {
  readonly id: string;
  readonly fullName: string;
  readonly designation: string | null;
  readonly role: Role;
  readonly avatarHue: number;
  readonly status: 'invited' | 'active' | 'deactivated';
}

export interface ProjectRefView {
  readonly id: string;
  readonly reference: string;
  readonly name: string;
  readonly colorIndex: number;
}

export interface TaskRefView {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly status: TaskStatus;
  readonly dueDate: string | null;
}

export interface TaskSummaryView extends TaskRefView {
  /** "HH:mm" in the business timezone; null = the end of the working day. */
  readonly dueTime: string | null;
  readonly priority: TaskPriority;
  readonly project: ProjectRefView;
  readonly projectCriticality: ProjectCriticality;
  readonly stage: { readonly id: string; readonly name: string } | null;
  readonly milestone: {
    readonly id: string;
    readonly name: string;
    readonly dueDate: string;
  } | null;
  readonly owner: UserSummaryView | null;
  readonly reviewer: UserSummaryView | null;
  readonly plannedStartDate: string | null;
  readonly estimateMinutes: number | null;
  readonly checklist: {
    readonly done: number;
    readonly total: number;
    readonly requiredRemaining: number;
  };
  readonly isOverdue: boolean;
  readonly hasOpenBlocker: boolean;
  readonly requiresReview: boolean;
  readonly needsAcknowledgement: boolean;
  readonly version: number;
}
