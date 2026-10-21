import { correctionProblem, domainEvent } from '@lintel/domain';
import {
  type Clock,
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  StaleVersionError,
  ValidationFailedError,
} from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { NotifierFactory } from '../notifications/notifier-factory';
import { applyCorrection, loadChallengeable } from './challengeable-records';
import type { ChallengeRecordSnapshot } from './reward-challenge.store';
import { sendRewardNotice } from './reward-notices';

type ResolveStores = Pick<
  ApplicationStores,
  'rewards' | 'milestoneRewards' | 'rewardChallenges' | 'records' | 'notifications'
>;

export interface ChallengeResolutionInput {
  /** uphold = the record stands; correct = grant it, or raise the amount granted. */
  readonly outcome: 'uphold' | 'correct';
  readonly note: string;
  /** Required to correct; the amount the person receives after the correction. */
  readonly correctedAmountMinor: number | null;
  readonly version: number;
}

/**
 * A reviewer (`rewards.decide`) answers a challenge with a note: uphold the
 * record, or correct it. A correction can only grant a reward or raise one
 * already granted — a challenge never costs the person anything. Neither the
 * person who raised it nor anyone the record is about may answer it.
 */
export class ResolveRewardChallengeCommand {
  constructor(
    private readonly uow: UnitOfWork<ResolveStores>,
    private readonly clock: Clock,
    private readonly notifierFor: NotifierFactory,
  ) {}

  async execute(
    context: RequestContext,
    challengeId: string,
    input: ChallengeResolutionInput,
  ): Promise<void> {
    if (!context.actor.capabilities.has('rewards.decide')) throw new ForbiddenError();
    const correcting = input.outcome === 'correct';
    if (correcting !== (input.correctedAmountMinor !== null)) {
      throw new ValidationFailedError('A corrected amount goes with a correction only.', [
        {
          field: 'correctedAmountMinor',
          message: correcting ? 'Enter the corrected amount.' : 'Leave this empty to uphold.',
        },
      ]);
    }
    const now = this.clock.now();
    await this.uow.transaction(async (stores) => {
      const challenge = await stores.rewardChallenges.find(challengeId);
      if (!challenge) throw new NotFoundError('Challenge');
      if (challenge.status !== 'open') {
        throw new InvalidTransitionError(`This challenge was already ${challenge.status}.`);
      }
      if (challenge.version !== input.version) throw new StaleVersionError('This challenge');
      const record = await loadChallengeable(stores, challenge.target);
      if (!record) throw new NotFoundError('Reward record');
      if (
        challenge.raisedByUserId === context.actor.userId ||
        record.subjectUserIds.includes(context.actor.userId)
      ) {
        throw new ForbiddenError('Someone else answers a challenge about your own reward.');
      }
      let after: ChallengeRecordSnapshot = record.snapshot;
      if (input.correctedAmountMinor !== null) {
        const problem = correctionProblem(record.snapshot, input.correctedAmountMinor);
        if (problem) {
          throw new ValidationFailedError(problem, [
            { field: 'correctedAmountMinor', message: problem },
          ]);
        }
        const corrected = await applyCorrection(stores, record, {
          status: 'approved',
          decidedByUserId: context.actor.userId,
          decidedAt: now,
          decisionNote: input.note,
          adjustedAmountMinor: input.correctedAmountMinor,
          adjustmentReason: input.note,
        });
        if (!corrected) throw new StaleVersionError('This reward record');
        after = {
          status: 'approved',
          grantedAmountMinor: input.correctedAmountMinor,
          decisionNote: input.note,
        };
      }
      const status = correcting ? 'corrected' : 'upheld';
      const resolved = await stores.rewardChallenges.resolve(challenge.id, challenge.version, {
        status,
        resolvedByUserId: context.actor.userId,
        resolvedAt: now,
        resolutionNote: input.note,
        recordAfter: after,
      });
      if (!resolved) throw new StaleVersionError('This challenge');
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: `rewards.challenge_${status}`,
        entityType: 'reward_challenge',
        entityId: challenge.id,
        before: { record: record.snapshot, reason: challenge.reason },
        after: { record: after, note: input.note },
        requestId: context.requestId,
      });
      await stores.records.enqueueEvent(
        domainEvent('RewardChallengeResolved', 'reward_challenge', challenge.id, {
          challengeId: challenge.id,
          status,
        }),
      );
      const recipients = correcting
        ? [challenge.raisedByUserId, ...record.subjectUserIds]
        : [challenge.raisedByUserId];
      await sendRewardNotice(await this.notifierFor(stores), 'reward_updated', recipients, {
        title: correcting
          ? `Your challenge was accepted: ${record.title}`
          : `Your challenge was answered: ${record.title}`,
        body: correcting
          ? 'The record was corrected. See the note in Rewards.'
          : 'The record stands. See the reviewer’s note in Rewards.',
        linkPath: '/rewards',
        subjectType: 'reward_challenge',
        subjectId: challenge.id,
        window: status,
      });
    });
  }
}
