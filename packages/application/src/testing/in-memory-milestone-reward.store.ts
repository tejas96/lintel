import type { DocumentFolder, MilestoneRewardStatus } from '@lintel/domain';
import type {
  MilestoneRewardFactsRecord,
  MilestoneRewardPlanRecord,
  MilestoneRewardShareInput,
  MilestoneRewardStore,
  MilestoneRewardTarget,
  MilestoneShareAssessment,
  NewMilestoneRewardPlan,
  RewardDecisionChange,
} from '../rewards/milestone-reward.store';

interface StoredShare {
  id: string;
  planId: string;
  userId: string;
  position: number;
  shareAmountMinor: number;
  status: MilestoneRewardStatus;
  assessment: MilestoneShareAssessment | null;
  decision: RewardDecisionChange | null;
  version: number;
}

type StoredPlan = Omit<MilestoneRewardPlanRecord, 'recipients'> & { withdrawReason: string | null };

/** Test double for milestone rewards: plans, shares, facts and decisions in memory. */
export class InMemoryMilestoneRewardStore implements MilestoneRewardStore {
  readonly targets = new Map<string, MilestoneRewardTarget>();
  readonly plans: StoredPlan[] = [];
  readonly shares: StoredShare[] = [];
  /** People working on each project, already in name order. */
  readonly projectPeople = new Map<string, string[]>();
  facts: MilestoneRewardFactsRecord = { deliverables: [], foldersOnFile: new Set(), blockers: [] };
  private sequence = 0;

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  async findTarget(milestoneId: string) {
    return this.targets.get(milestoneId) ?? null;
  }
  async findPlanByMilestone(milestoneId: string): Promise<MilestoneRewardPlanRecord | null> {
    const plan = this.plans.find((row) => row.milestoneId === milestoneId);
    if (!plan) return null;
    const recipients = this.shares
      .filter((share) => share.planId === plan.id)
      .sort((left, right) => left.position - right.position)
      .map(({ id, userId, status, shareAmountMinor, decision }) => ({
        id,
        userId,
        status,
        shareAmountMinor,
        adjustedAmountMinor: decision?.adjustedAmountMinor ?? null,
      }));
    return { ...plan, recipients };
  }
  async eligibleRecipients(projectId: string, userIds: readonly string[]) {
    return (this.projectPeople.get(projectId) ?? []).filter((id) => userIds.includes(id));
  }
  async createPlan(plan: NewMilestoneRewardPlan) {
    const id = this.nextId('plan');
    this.plans.push({ ...this.planFields(plan), id, version: 1 });
    return { id };
  }
  async updatePlan(planId: string, expectedVersion: number, plan: NewMilestoneRewardPlan) {
    const index = this.plans.findIndex((row) => row.id === planId);
    const current = this.plans[index];
    if (!current || current.version !== expectedVersion) return false;
    this.plans[index] = { ...this.planFields(plan), id: planId, version: current.version + 1 };
    return true;
  }
  async replaceShares(planId: string, shares: readonly MilestoneRewardShareInput[]) {
    for (let index = this.shares.length - 1; index >= 0; index -= 1) {
      const share = this.shares[index];
      if (share?.planId === planId && !shares.some((next) => next.userId === share.userId)) {
        this.shares.splice(index, 1);
      }
    }
    for (const next of shares) {
      const existing = this.shares.find((s) => s.planId === planId && s.userId === next.userId);
      if (existing) Object.assign(existing, next, { status: 'planned' });
      else {
        this.shares.push({
          ...next,
          id: this.nextId('share'),
          planId,
          status: 'planned',
          assessment: null,
          decision: null,
          version: 1,
        });
      }
    }
  }
  async withdrawPlan(
    planId: string,
    expectedVersion: number,
    withdrawal: { at: Date; reason: string },
  ) {
    const plan = this.plans.find((row) => row.id === planId);
    if (!plan || plan.version !== expectedVersion) return false;
    Object.assign(plan, {
      withdrawnAt: withdrawal.at,
      withdrawReason: withdrawal.reason,
      version: plan.version + 1,
    });
    for (const share of this.shares.filter((s) => s.planId === planId)) share.status = 'withdrawn';
    return true;
  }
  async factsAt() {
    return this.facts;
  }
  async recordAssessment(shareId: string, assessment: MilestoneShareAssessment) {
    const share = this.shares.find((row) => row.id === shareId);
    if (share)
      Object.assign(share, { assessment, status: 'pending_review', version: share.version + 1 });
  }
  async markEvaluated(planId: string, at: Date) {
    const plan = this.plans.find((row) => row.id === planId);
    if (plan) Object.assign(plan, { evaluatedAt: at });
  }
  async findShare(shareId: string) {
    const share = this.shares.find((row) => row.id === shareId);
    const plan = this.plans.find((row) => row.id === share?.planId);
    if (!share || !plan) return null;
    return {
      id: share.id,
      planId: plan.id,
      milestoneId: plan.milestoneId,
      milestoneName: this.targets.get(plan.milestoneId)?.milestoneName ?? '?',
      projectId: plan.projectId,
      userId: share.userId,
      status: share.status,
      shareAmountMinor: share.shareAmountMinor,
      adjustedAmountMinor: share.decision?.adjustedAmountMinor ?? null,
      decidedByUserId: share.decision?.decidedByUserId ?? null,
      decisionNote: share.decision?.decisionNote ?? null,
      version: share.version,
    };
  }
  async decideShare(
    shareId: string,
    expectedVersion: number,
    expectedStatus: MilestoneRewardStatus,
    decision: RewardDecisionChange,
  ) {
    const share = this.shares.find((row) => row.id === shareId);
    if (!share || share.version !== expectedVersion || share.status !== expectedStatus)
      return false;
    Object.assign(share, { decision, status: decision.status, version: share.version + 1 });
    return true;
  }

  private planFields(plan: NewMilestoneRewardPlan) {
    return {
      milestoneId: plan.milestoneId,
      projectId: plan.projectId,
      scope: plan.scope,
      amountMinor: plan.amountMinor,
      currency: plan.currency,
      requiredDocumentFolders: [...plan.requiredDocumentFolders] as DocumentFolder[],
      note: plan.note,
      agreedDueDate: plan.agreedDueDate,
      evaluatedAt: null,
      withdrawnAt: null,
      withdrawReason: null,
    };
  }
}
