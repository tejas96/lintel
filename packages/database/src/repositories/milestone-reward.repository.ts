import type {
  MilestoneRewardPlanRecord,
  MilestoneRewardShareInput,
  MilestoneRewardStore,
  MilestoneShareAssessment,
  NewMilestoneRewardPlan,
  RewardDecisionChange,
} from '@lintel/application';
import { DOCUMENT_FOLDERS, type DocumentFolder, type MilestoneRewardStatus } from '@lintel/domain';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import {
  milestoneRewardRecipients,
  milestoneRewards,
  milestones,
  projectMembers,
  projects,
  users,
} from '../schema';
import { loadMilestoneRewardFacts } from './milestone-reward-facts.queries';
import {
  insertRewardPlan,
  replaceRewardShares,
  updateRewardPlan,
  withdrawRewardPlan,
} from './milestone-reward-plan.writer';

const isFolder = (value: string): value is DocumentFolder =>
  (DOCUMENT_FOLDERS as readonly string[]).includes(value);

const recipients = milestoneRewardRecipients;

export class MilestoneRewardRepository implements MilestoneRewardStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async findTarget(milestoneId: string) {
    const [row] = await this.db
      .select({
        milestoneId: milestones.id,
        projectId: milestones.projectId,
        milestoneName: milestones.name,
        dueDate: milestones.dueDate,
        status: milestones.status,
      })
      .from(milestones)
      .where(eq(milestones.id, milestoneId));
    return row ?? null;
  }

  async findPlanByMilestone(milestoneId: string): Promise<MilestoneRewardPlanRecord | null> {
    const [plan] = await this.db
      .select()
      .from(milestoneRewards)
      .where(eq(milestoneRewards.milestoneId, milestoneId));
    if (!plan) return null;
    const shares = await this.db
      .select({
        id: recipients.id,
        userId: recipients.userId,
        status: recipients.status,
        shareAmountMinor: recipients.shareAmountMinor,
      })
      .from(recipients)
      .where(eq(recipients.milestoneRewardId, plan.id))
      .orderBy(asc(recipients.position));
    return {
      id: plan.id,
      milestoneId: plan.milestoneId,
      projectId: plan.projectId,
      scope: plan.scope,
      amountMinor: plan.amountMinor,
      currency: plan.currency,
      requiredDocumentFolders: plan.requiredDocumentFolders.filter(isFolder),
      note: plan.note,
      agreedDueDate: plan.agreedDueDate,
      evaluatedAt: plan.evaluatedAt,
      withdrawnAt: plan.withdrawnAt,
      version: plan.version,
      recipients: shares,
    };
  }

  /** Active people who manage, own or are members of the project, by name (the split order). */
  async eligibleRecipients(projectId: string, userIds: readonly string[]) {
    if (userIds.length === 0) return [];
    const members = this.db
      .select({ id: projectMembers.userId })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId));
    const [project] = await this.db
      .select({ managerUserId: projects.managerUserId, ownerUserId: projects.ownerUserId })
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!project) return [];
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          inArray(users.id, [...userIds]),
          eq(users.status, 'active'),
          or(
            inArray(users.id, members),
            eq(users.id, project.managerUserId),
            eq(users.id, project.ownerUserId),
          ),
        ),
      )
      .orderBy(asc(users.fullName), asc(users.id));
    return rows.map((row) => row.id);
  }

  createPlan(plan: NewMilestoneRewardPlan) {
    return insertRewardPlan(this.db, plan);
  }

  updatePlan(planId: string, expectedVersion: number, plan: NewMilestoneRewardPlan) {
    return updateRewardPlan(this.db, planId, expectedVersion, plan);
  }

  replaceShares(planId: string, shares: readonly MilestoneRewardShareInput[]) {
    return replaceRewardShares(this.db, planId, shares);
  }

  withdrawPlan(
    planId: string,
    expectedVersion: number,
    withdrawal: { at: Date; byUserId: string; reason: string },
  ) {
    return withdrawRewardPlan(this.db, planId, expectedVersion, withdrawal);
  }

  factsAt(milestoneId: string, completedAt: Date) {
    return loadMilestoneRewardFacts(this.db, milestoneId, completedAt);
  }

  async recordAssessment(shareId: string, assessment: MilestoneShareAssessment) {
    await this.db
      .update(recipients)
      .set({
        status: 'pending_review',
        recommendation: assessment.recommendation,
        summary: assessment.summary,
        evidence: { ...assessment.evidence, checks: [...assessment.evidence.checks] },
        version: sql`${recipients.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(recipients.id, shareId), eq(recipients.status, 'planned')));
  }

  async markEvaluated(planId: string, at: Date) {
    await this.db
      .update(milestoneRewards)
      .set({ evaluatedAt: at, updatedAt: at })
      .where(eq(milestoneRewards.id, planId));
  }

  async findShare(shareId: string) {
    const [row] = await this.db
      .select({
        id: recipients.id,
        planId: milestoneRewards.id,
        milestoneId: milestoneRewards.milestoneId,
        milestoneName: milestones.name,
        projectId: milestoneRewards.projectId,
        userId: recipients.userId,
        status: recipients.status,
        shareAmountMinor: recipients.shareAmountMinor,
        adjustedAmountMinor: recipients.adjustedAmountMinor,
        decidedByUserId: recipients.decidedByUserId,
        decisionNote: recipients.decisionNote,
        version: recipients.version,
      })
      .from(recipients)
      .innerJoin(milestoneRewards, eq(milestoneRewards.id, recipients.milestoneRewardId))
      .innerJoin(milestones, eq(milestones.id, milestoneRewards.milestoneId))
      .where(eq(recipients.id, shareId));
    return row ?? null;
  }

  async decideShare(
    shareId: string,
    expectedVersion: number,
    expectedStatus: MilestoneRewardStatus,
    decision: RewardDecisionChange,
  ) {
    const rows = await this.db
      .update(recipients)
      .set({ ...decision, version: sql`${recipients.version} + 1`, updatedAt: decision.decidedAt })
      .where(
        and(
          eq(recipients.id, shareId),
          eq(recipients.version, expectedVersion),
          eq(recipients.status, expectedStatus),
        ),
      )
      .returning({ id: recipients.id });
    return rows.length > 0;
  }
}
