import { challengeRefusal, domainEvent } from '@lintel/domain';
import { ForbiddenError, NotFoundError, PreconditionFailedError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { NotifierFactory } from '../notifications/notifier-factory';
import { loadChallengeable } from './challengeable-records';
import type { ChallengeTarget } from './reward-challenge.store';
import { excerpt, sendRewardNotice } from './reward-notices';

type ChallengeStores = Pick<
  ApplicationStores,
  'rewards' | 'milestoneRewards' | 'rewardChallenges' | 'records' | 'notifications'
>;

const ALREADY_OPEN = 'A challenge of this record is already waiting for a reviewer.';

/**
 * The person a reward record is about (or a member of its team) challenges
 * it with a reason. It goes to the reviewer who decided it — or, when that
 * person no longer reviews rewards or nobody decided it, to everyone holding
 * `rewards.decide`. Records the person cannot see answer 404.
 */
export class RaiseRewardChallengeCommand {
  constructor(
    private readonly uow: UnitOfWork<ChallengeStores>,
    private readonly notifierFor: NotifierFactory,
  ) {}

  async execute(
    context: RequestContext,
    target: ChallengeTarget,
    reason: string,
  ): Promise<{ challengeId: string }> {
    if (!context.actor.capabilities.has('rewards.view_own')) throw new ForbiddenError();
    return this.uow.transaction(async (stores) => {
      const record = await loadChallengeable(stores, target);
      const isSubject = record?.subjectUserIds.includes(context.actor.userId) ?? false;
      if (!record || !isSubject) throw new NotFoundError('Reward record');
      const history = await stores.rewardChallenges.historyOf(target);
      const refusal = challengeRefusal({
        record: record.snapshot,
        isSubject,
        hasOpenChallenge: history.open,
        challengesSoFar: history.total,
      });
      if (refusal) throw new PreconditionFailedError(refusal);
      const challenge = await stores.rewardChallenges.create({
        target,
        raisedByUserId: context.actor.userId,
        reason,
        recordBefore: record.snapshot,
      });
      if (!challenge) throw new PreconditionFailedError(ALREADY_OPEN);
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'rewards.challenge_raised',
        entityType: 'reward_challenge',
        entityId: challenge.id,
        after: {
          recordKind: target.kind,
          recordId: target.recordId,
          reason,
          record: record.snapshot,
        },
        requestId: context.requestId,
      });
      await stores.records.enqueueEvent(
        domainEvent('RewardChallengeRaised', 'reward_challenge', challenge.id, {
          challengeId: challenge.id,
          recordKind: target.kind,
          recordId: target.recordId,
        }),
      );
      const reviewers = (await stores.rewardChallenges.reviewerUserIds()).filter(
        (userId) => !record.subjectUserIds.includes(userId),
      );
      const decider = record.decidedByUserId;
      await sendRewardNotice(
        await this.notifierFor(stores),
        'reward_review_requested',
        decider && reviewers.includes(decider) ? [decider] : reviewers,
        {
          title: `A reward record is challenged: ${record.title}`,
          body: `“${excerpt(reason)}”`,
          linkPath: '/rewards/review',
          subjectType: 'reward_challenge',
          subjectId: challenge.id,
          window: 'raised',
        },
      );
      return { challengeId: challenge.id };
    });
  }
}
