import { and, asc, eq, ne } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import {
  milestoneRewardRecipients,
  milestoneRewards,
  milestones,
  projects,
  rewardChallenges,
  users,
} from '../../schema';
import { type ApprovalDraft, projectRefColumns, SOURCE_LIMIT } from './approval-sources.work';

/** Milestone rewards waiting for a decision, except the reviewer's own. */
export async function milestoneRewardApprovals(
  db: DatabaseExecutor,
  viewerUserId: string,
): Promise<ApprovalDraft[]> {
  const rows = await db
    .select({
      shareId: milestoneRewardRecipients.id,
      recommendation: milestoneRewardRecipients.recommendation,
      updatedAt: milestoneRewardRecipients.updatedAt,
      milestone: milestones.name,
      person: users.fullName,
      project: projectRefColumns,
    })
    .from(milestoneRewardRecipients)
    .innerJoin(
      milestoneRewards,
      eq(milestoneRewards.id, milestoneRewardRecipients.milestoneRewardId),
    )
    .innerJoin(milestones, eq(milestones.id, milestoneRewards.milestoneId))
    .innerJoin(projects, eq(projects.id, milestoneRewards.projectId))
    .innerJoin(users, eq(users.id, milestoneRewardRecipients.userId))
    .where(
      and(
        eq(milestoneRewardRecipients.status, 'pending_review'),
        ne(milestoneRewardRecipients.userId, viewerUserId),
      ),
    )
    .orderBy(asc(milestoneRewardRecipients.updatedAt))
    .limit(SOURCE_LIMIT);
  return rows.map((row) => ({
    type: 'reward_review',
    id: row.shareId,
    title: `Milestone reward: ${row.milestone}`,
    subtitle: `${row.person} · ${row.recommendation === 'grant' ? 'every condition met' : 'not every condition met'}`,
    requestedByUserId: null,
    requestedAt: row.updatedAt,
    project: row.project,
    linkPath: '/rewards/review?kind=milestones',
    urgency: 'normal',
  }));
}

/** Open challenges of reward records, except the reviewer's own. */
export async function rewardChallengeApprovals(
  db: DatabaseExecutor,
  viewerUserId: string,
): Promise<ApprovalDraft[]> {
  const rows = await db
    .select({
      id: rewardChallenges.id,
      raisedBy: rewardChallenges.raisedByUserId,
      raisedAt: rewardChallenges.createdAt,
      reason: rewardChallenges.reason,
    })
    .from(rewardChallenges)
    .where(
      and(eq(rewardChallenges.status, 'open'), ne(rewardChallenges.raisedByUserId, viewerUserId)),
    )
    .orderBy(asc(rewardChallenges.createdAt))
    .limit(SOURCE_LIMIT);
  return rows.map((row) => ({
    type: 'reward_review',
    id: row.id,
    title: 'Reward record challenged',
    subtitle: row.reason.length > 90 ? `${row.reason.slice(0, 89)}…` : row.reason,
    requestedByUserId: row.raisedBy,
    requestedAt: row.raisedAt,
    project: null,
    linkPath: '/rewards/review?kind=challenges',
    urgency: 'high',
  }));
}
