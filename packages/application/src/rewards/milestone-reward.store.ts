import type {
  DocumentFolder,
  MilestoneCheckResult,
  MilestoneDeliverableFact,
  MilestoneRewardStatus,
  MilestoneStatus,
  RewardScope,
} from '@lintel/domain';

/** The milestone a reward is attached to, as the rules and notices need it. */
export interface MilestoneRewardTarget {
  readonly milestoneId: string;
  readonly projectId: string;
  readonly milestoneName: string;
  /** The current due date; it only moves when a scope change is approved. */
  readonly dueDate: string;
  readonly status: MilestoneStatus;
}

export interface MilestoneRewardPlanInput {
  readonly scope: RewardScope;
  readonly amountMinor: number;
  readonly requiredDocumentFolders: readonly DocumentFolder[];
  readonly note: string | null;
}

export interface MilestoneRewardRecipientRecord {
  readonly id: string;
  readonly userId: string;
  readonly status: MilestoneRewardStatus;
  readonly shareAmountMinor: number;
  /** The amount granted when a reviewer changed it; null otherwise. */
  readonly adjustedAmountMinor: number | null;
}

export interface MilestoneRewardPlanRecord extends MilestoneRewardPlanInput {
  readonly id: string;
  readonly milestoneId: string;
  readonly projectId: string;
  readonly currency: string;
  readonly agreedDueDate: string;
  readonly evaluatedAt: Date | null;
  readonly withdrawnAt: Date | null;
  readonly version: number;
  /** In split order (by name). */
  readonly recipients: readonly MilestoneRewardRecipientRecord[];
}

export interface NewMilestoneRewardPlan extends MilestoneRewardPlanInput {
  readonly milestoneId: string;
  readonly projectId: string;
  readonly currency: string;
  readonly agreedDueDate: string;
  readonly actorUserId: string;
}

export interface MilestoneRewardShareInput {
  readonly userId: string;
  readonly position: number;
  readonly shareAmountMinor: number;
}

/** A blocker on the milestone's tasks, as instants. */
export interface MilestoneBlockerRecord {
  readonly category: string;
  readonly waitingOnUserId: string | null;
  readonly raisedAt: Date;
  readonly resolvedAt: Date | null;
}

/** The records the rules look at, read when the milestone is completed. */
export interface MilestoneRewardFactsRecord {
  readonly deliverables: readonly MilestoneDeliverableFact[];
  /** Folders with at least one current document added by the completion instant. */
  readonly foldersOnFile: ReadonlySet<DocumentFolder>;
  readonly blockers: readonly MilestoneBlockerRecord[];
}

export interface MilestoneRewardEvidence {
  readonly checks: readonly MilestoneCheckResult[];
  readonly agreedDueDate: string;
  readonly dueDate: string;
  readonly completedOn: string;
}

export interface MilestoneShareAssessment {
  readonly recommendation: 'grant' | 'withhold';
  readonly summary: string;
  readonly evidence: MilestoneRewardEvidence;
}

/** One person's share with what decisions and challenges need. */
export interface MilestoneRewardShareRecord {
  readonly id: string;
  readonly planId: string;
  readonly milestoneId: string;
  readonly milestoneName: string;
  readonly projectId: string;
  readonly userId: string;
  readonly status: MilestoneRewardStatus;
  readonly shareAmountMinor: number;
  readonly adjustedAmountMinor: number | null;
  readonly decidedByUserId: string | null;
  readonly decisionNote: string | null;
  readonly version: number;
}

export interface RewardDecisionChange {
  readonly status: 'approved' | 'rejected';
  readonly decidedByUserId: string;
  readonly decidedAt: Date;
  readonly decisionNote: string;
  readonly adjustedAmountMinor: number | null;
  readonly adjustmentReason: string | null;
}

/** Persistence for milestone rewards: the plan, each person's share and its outcome. */
export interface MilestoneRewardStore {
  findTarget(milestoneId: string): Promise<MilestoneRewardTarget | null>;
  findPlanByMilestone(milestoneId: string): Promise<MilestoneRewardPlanRecord | null>;
  /**
   * The given people who are active and work on the project (its manager,
   * owner or a member), sorted by name — the order of the split.
   */
  eligibleRecipients(projectId: string, userIds: readonly string[]): Promise<string[]>;
  createPlan(plan: NewMilestoneRewardPlan): Promise<{ id: string }>;
  /** Updates (and revives a withdrawn) plan when the version still matches. */
  updatePlan(
    planId: string,
    expectedVersion: number,
    plan: NewMilestoneRewardPlan,
  ): Promise<boolean>;
  /** Replaces the planned shares: people left out are removed, the rest are saved. */
  replaceShares(planId: string, shares: readonly MilestoneRewardShareInput[]): Promise<void>;
  withdrawPlan(
    planId: string,
    expectedVersion: number,
    withdrawal: { readonly at: Date; readonly byUserId: string; readonly reason: string },
  ): Promise<boolean>;
  factsAt(milestoneId: string, completedAt: Date): Promise<MilestoneRewardFactsRecord>;
  /** Moves a planned share to pending_review with its recommendation and evidence. */
  recordAssessment(shareId: string, assessment: MilestoneShareAssessment): Promise<void>;
  markEvaluated(planId: string, at: Date): Promise<void>;
  findShare(shareId: string): Promise<MilestoneRewardShareRecord | null>;
  /** Decides a share waiting for review, or grants a settled one on a correction. */
  decideShare(
    shareId: string,
    expectedVersion: number,
    expectedStatus: MilestoneRewardStatus,
    decision: RewardDecisionChange,
  ): Promise<boolean>;
}
