import type {
  CriterionResult,
  RewardCriterion,
  RewardEvaluationStatus,
  RewardPeriod,
  RewardScope,
} from '@lintel/domain';

export interface RewardPolicyInput {
  readonly name: string;
  readonly description: string | null;
  readonly scope: RewardScope;
  readonly period: RewardPeriod;
  readonly criteria: readonly RewardCriterion[];
  readonly amountMinor: number;
  readonly isActive: boolean;
}

export interface RewardPolicyRecord extends RewardPolicyInput {
  readonly id: string;
  readonly currency: string;
  readonly version: number;
}

/** A finished task as stored: the raw material for reward facts. */
export interface CompletedTaskRecord {
  readonly taskId: string;
  readonly ownerUserId: string | null;
  readonly collaboratorUserIds: readonly string[];
  readonly completedAt: Date;
  /** The current due date, which already reflects approved schedule changes. */
  readonly dueDate: string | null;
  readonly requiresReview: boolean;
  readonly reviewRounds: number;
  /** Completion instants of the required checklist items (null = never completed). */
  readonly requiredChecklistCompletedAt: readonly (Date | null)[];
  readonly blockers: readonly { category: string; raisedAt: Date; resolvedAt: Date | null }[];
}

export interface BlockerReportRecord {
  readonly raisedByUserId: string;
  readonly raisedAt: Date;
  readonly taskDueDate: string | null;
}

export interface CompletedMilestoneRecord {
  readonly milestoneId: string;
  readonly dueDate: string;
  readonly completedAt: Date;
  /** Owners of the milestone's tasks: the people who delivered it. */
  readonly taskOwnerUserIds: readonly string[];
}

export interface RewardEvidence {
  readonly criteria: readonly CriterionResult[];
  readonly metrics: Readonly<Record<string, number | null>>;
  readonly policyVersion: number;
}

export interface RewardEvaluationUpsert {
  readonly policyId: string;
  /** `user:<id>` or `team:<id>`; with policy and period it identifies the evaluation. */
  readonly subjectKey: string;
  readonly userId: string | null;
  readonly teamId: string | null;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly status: 'ineligible' | 'pending_review';
  readonly summary: string;
  readonly evidence: RewardEvidence;
  readonly amountMinor: number;
}

/** created = new row; refreshed = an undecided row was updated; decided = left untouched. */
export type RewardUpsertOutcome = 'created' | 'refreshed' | 'decided';

export interface RewardEvaluationRecord {
  readonly id: string;
  readonly policyId: string;
  readonly policyName: string;
  readonly userId: string | null;
  readonly teamId: string | null;
  readonly periodStart: string;
  readonly status: RewardEvaluationStatus;
  readonly amountMinor: number;
  readonly version: number;
}

export interface RewardDecision {
  readonly status: 'approved' | 'rejected';
  readonly decidedByUserId: string;
  readonly decidedAt: Date;
  readonly decisionNote: string;
  readonly adjustedAmountMinor: number | null;
  readonly adjustmentReason: string | null;
}

/** Persistence for reward policies, evaluation facts and evaluations. */
export interface RewardStore {
  findPolicy(policyId: string): Promise<RewardPolicyRecord | null>;
  createPolicy(
    input: RewardPolicyInput,
    currency: string,
    createdByUserId: string,
  ): Promise<RewardPolicyRecord>;
  updatePolicy(
    policyId: string,
    expectedVersion: number,
    input: RewardPolicyInput,
  ): Promise<RewardPolicyRecord | null>;
  /** Active people other than the owner. */
  individualSubjects(): Promise<{ userId: string; teamId: string | null }[]>;
  /** Every team with its active members. */
  teamSubjects(): Promise<{ teamId: string; memberUserIds: string[] }[]>;
  /** Done tasks completed in [from, to) owned by, or shared with, any of the people. */
  completedTasks(userIds: readonly string[], from: Date, to: Date): Promise<CompletedTaskRecord[]>;
  blockerReports(userIds: readonly string[], from: Date, to: Date): Promise<BlockerReportRecord[]>;
  completedMilestones(from: Date, to: Date): Promise<CompletedMilestoneRecord[]>;
  /** Inserts, or refreshes an undecided evaluation; decided evaluations are never touched. */
  upsertEvaluation(input: RewardEvaluationUpsert): Promise<RewardUpsertOutcome>;
  findEvaluation(evaluationId: string): Promise<RewardEvaluationRecord | null>;
  decideEvaluation(
    evaluationId: string,
    expectedVersion: number,
    decision: RewardDecision,
  ): Promise<boolean>;
  teamMemberIds(teamId: string): Promise<string[]>;
}
