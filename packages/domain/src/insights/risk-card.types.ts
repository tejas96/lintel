import type { CalendarDate } from '@lintel/shared';
import type { WorkingCalendar } from '../calendar/working-calendar';
import type { MilestoneHealth } from '../projects/milestone-risk';
import type { ProjectCriticality } from '../projects/project-status';
import type { TaskDependencyEdge } from '../tasks/task-dependency-graph';
import type { TaskPriority, TaskStatus } from '../tasks/task-status';

/** Which rule explained the risk; rules are tried in this order (first match wins). */
export const RISK_RULES = [
  'date_request_waiting',
  'blocked',
  'review_waiting',
  'owner_away',
  'overdue',
  'late_start',
  'scheduled_late',
  'missed_without_open_work',
] as const;
export type RiskRule = (typeof RISK_RULES)[number];

export type BlockerCategoryName =
  | 'client'
  | 'supplier'
  | 'internal_dependency'
  | 'manager_decision'
  | 'information'
  | 'other';

export interface RiskTaskFacts {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly ownerUserId: string | null;
  readonly reviewerUserId: string | null;
  readonly plannedStartDate: CalendarDate | null;
  readonly dueDate: CalendarDate | null;
  readonly escalateAfterOverdueDays: number;
  /** When the work went to review (only while in review). */
  readonly submittedAt: Date | null;
  readonly openBlocker: {
    readonly category: BlockerCategoryName;
    readonly reason: string;
    readonly raisedAt: Date;
    readonly waitingOnUserId: string | null;
  } | null;
  readonly openDateRequest: {
    readonly id: string;
    readonly proposedDueDate: CalendarDate;
  } | null;
  /** Approved leave of the owner overlapping today … due date. */
  readonly ownerAway: {
    readonly leaveRequestId: string;
    readonly startDate: CalendarDate;
    readonly endDate: CalendarDate;
  } | null;
}

/** A dated promise: a pending milestone, or the project's planned delivery date. */
export interface RiskCommitment {
  readonly kind: 'milestone' | 'delivery';
  /** Milestone id, or the project id for the delivery date. */
  readonly id: string;
  readonly name: string;
  readonly dueDate: CalendarDate;
  /** From the milestone risk rules; null for the delivery date. */
  readonly health: MilestoneHealth | null;
  readonly taskIds: readonly string[];
}

export interface RiskProjectFacts {
  readonly id: string;
  readonly criticality: ProjectCriticality;
  readonly managerUserId: string;
  readonly commitments: readonly RiskCommitment[];
  readonly tasks: readonly RiskTaskFacts[];
  readonly dependencies: readonly TaskDependencyEdge[];
}

export interface RiskContext {
  readonly today: CalendarDate;
  readonly now: Date;
  /** The studio calendar: forecasts and escalation times are in working days on it. */
  readonly calendar: WorkingCalendar;
  readonly reminderTime: string;
}

export type ResponsibleRole = 'task_owner' | 'reviewer' | 'project_manager' | 'waiting_on';

export type RiskLinkTarget =
  | { readonly kind: 'task'; readonly id: string }
  | { readonly kind: 'date_request'; readonly id: string; readonly taskId: string }
  | { readonly kind: 'leave'; readonly id: string }
  | { readonly kind: 'project'; readonly id: string };

export interface RiskEscalation {
  readonly audience: 'reviewer' | 'project_manager' | 'business_owner';
  readonly at: Date;
  /** True when the last alert already went out and the risk is still open. */
  readonly alreadyHappened: boolean;
  readonly summary: string;
}

export interface RiskCard {
  /** Stable for one commitment and rule, e.g. "milestone:<id>:blocked:<taskId>". */
  readonly key: string;
  readonly rule: RiskRule;
  /** critical: already missed or forecast late; risk: could still slip. */
  readonly severity: 'risk' | 'critical';
  readonly projectId: string;
  readonly commitment: Pick<RiskCommitment, 'kind' | 'id' | 'name' | 'dueDate'>;
  readonly task: { readonly id: string; readonly title: string } | null;
  readonly happening: string;
  readonly impact: {
    readonly slipWorkingDays: number;
    readonly forecastDate: CalendarDate | null;
    readonly summary: string;
  };
  readonly nextAction: { readonly label: string; readonly target: RiskLinkTarget };
  readonly responsible: { readonly role: ResponsibleRole; readonly userId: string | null };
  readonly escalation: RiskEscalation | null;
}
