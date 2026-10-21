import {
  assessMilestoneReward,
  DEFAULT_WORKING_CALENDAR,
  type DelayBlockerFact,
  domainEvent,
} from '@lintel/domain';
import { calendarDateInTimeZone, toCalendarDate } from '@lintel/shared';
import type { ApplicationStores } from '../common/unit-of-work';
import type { NotifierFactory } from '../notifications/notifier-factory';
import type { MilestoneBlockerRecord } from './milestone-reward.store';
import { sendRewardNotice } from './reward-notices';

type EvaluationStores = Pick<
  ApplicationStores,
  'milestoneRewards' | 'rewardChallenges' | 'settings' | 'records' | 'notifications'
>;

function blockerDays(
  blocker: MilestoneBlockerRecord,
  completedAt: Date,
  timeZone: string,
): DelayBlockerFact {
  return {
    category: blocker.category,
    waitingOnUserId: blocker.waitingOnUserId,
    raisedOn: calendarDateInTimeZone(blocker.raisedAt, timeZone),
    resolvedOn: calendarDateInTimeZone(blocker.resolvedAt ?? completedAt, timeZone),
  };
}

/**
 * Runs inside the milestone completion transaction. When the milestone has a
 * reward, each recipient's share is checked against the rules and moves to
 * "waiting for review" with a recommendation; reviewers and recipients are
 * told. Nothing is granted or paid here, and nothing is ever deducted.
 */
export async function evaluateMilestoneReward(
  stores: EvaluationStores,
  notifierFor: NotifierFactory,
  input: {
    readonly milestoneId: string;
    readonly completedAt: Date;
    readonly actorUserId: string;
    readonly requestId: string;
  },
): Promise<void> {
  const plan = await stores.milestoneRewards.findPlanByMilestone(input.milestoneId);
  if (!plan || plan.withdrawnAt !== null || plan.evaluatedAt !== null) return;
  const target = await stores.milestoneRewards.findTarget(input.milestoneId);
  if (!target) return;
  const { timeZone } = await stores.settings.organization();
  const facts = await stores.milestoneRewards.factsAt(input.milestoneId, input.completedAt);
  const recipients = plan.recipients.filter((share) => share.status === 'planned');
  const calendars = await stores.settings.calendarsForUsers(
    recipients.map((share) => share.userId),
  );
  const completedOn = calendarDateInTimeZone(input.completedAt, timeZone);
  const blockers = facts.blockers.map((blocker) =>
    blockerDays(blocker, input.completedAt, timeZone),
  );
  let recommended = 0;
  for (const share of recipients) {
    const assessment = assessMilestoneReward({
      recipientUserId: share.userId,
      agreedDueDate: toCalendarDate(plan.agreedDueDate),
      dueDate: toCalendarDate(target.dueDate),
      completedOn,
      deliverables: facts.deliverables,
      requiredFolders: plan.requiredDocumentFolders,
      foldersOnFile: facts.foldersOnFile,
      blockers,
      calendar: calendars.get(share.userId) ?? DEFAULT_WORKING_CALENDAR,
    });
    if (assessment.recommendation === 'grant') recommended += 1;
    await stores.milestoneRewards.recordAssessment(share.id, {
      recommendation: assessment.recommendation,
      summary: assessment.summary,
      evidence: {
        checks: assessment.checks,
        agreedDueDate: plan.agreedDueDate,
        dueDate: target.dueDate,
        completedOn,
      },
    });
  }
  await stores.milestoneRewards.markEvaluated(plan.id, input.completedAt);
  await stores.records.appendAudit({
    actorUserId: input.actorUserId,
    action: 'rewards.milestone_reward_evaluated',
    entityType: 'milestone_reward',
    entityId: plan.id,
    after: { recipients: recipients.length, recommended, completedOn },
    requestId: input.requestId,
  });
  await stores.records.enqueueEvent(
    domainEvent('MilestoneRewardEvaluated', 'milestone_reward', plan.id, {
      milestoneRewardId: plan.id,
      milestoneId: input.milestoneId,
      projectId: plan.projectId,
    }),
  );
  const notifier = await notifierFor(stores);
  const people = recipients.map((share) => share.userId);
  await sendRewardNotice(notifier, 'reward_updated', people, {
    title: `"${target.milestoneName}" is complete`,
    body: 'Your milestone reward was checked and is waiting for a reviewer.',
    linkPath: '/rewards',
    subjectType: 'milestone_reward',
    subjectId: plan.id,
    window: 'evaluated',
  });
  const reviewers = (await stores.rewardChallenges.reviewerUserIds()).filter(
    (id) => !people.includes(id),
  );
  await sendRewardNotice(notifier, 'reward_review_requested', reviewers, {
    title: `Milestone reward to review: "${target.milestoneName}"`,
    body: `${recommended} of ${recipients.length} met every condition. Nothing is granted until you decide.`,
    linkPath: '/rewards/review',
    subjectType: 'milestone_reward',
    subjectId: plan.id,
    window: 'evaluated',
  });
}
