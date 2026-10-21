import { fixedClock } from '@lintel/shared';
import type { ProjectAccessStore } from '../access/project-access.store';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import { Notifier } from '../notifications/notifier';
import type { NotifierFactory } from '../notifications/notifier-factory';
import { InMemoryMilestoneRewardStore } from './in-memory-milestone-reward.store';
import { InMemoryRewardStore } from './in-memory-reward.store';
import { InMemoryRewardChallengeStore } from './in-memory-reward-challenge.store';
import {
  CollectedNotifications,
  fakeSettings,
  leaveWorld,
  RecordedEffects,
  TEST_NOW,
} from './leave-test-world';

export type RewardWorldStores = Pick<
  ApplicationStores,
  | 'access'
  | 'rewards'
  | 'milestoneRewards'
  | 'rewardChallenges'
  | 'settings'
  | 'records'
  | 'notifications'
>;

/**
 * The leave world's studio (owner, admin, pm, lead, ana, dev) with one
 * project managed by pm, whose milestone "Concept approved" is due on
 * Monday 2 November 2026. ana and dev work on the project; lead does not.
 */
export function rewardWorld() {
  const { ctx } = leaveWorld();
  const clock = fixedClock(TEST_NOW);
  const rewards = new InMemoryRewardStore();
  const milestoneRewards = new InMemoryMilestoneRewardStore();
  milestoneRewards.targets.set('concept', {
    milestoneId: 'concept',
    projectId: 'project',
    milestoneName: 'Concept approved',
    dueDate: '2026-11-02',
    status: 'pending',
  });
  milestoneRewards.projectPeople.set('project', ['ana', 'dev', 'pm']);
  const rewardChallenges = new InMemoryRewardChallengeStore();
  const records = new RecordedEffects();
  const notifications = new CollectedNotifications();
  const access: ProjectAccessStore = {
    accessFacts: async (projectId, userId) => ({
      projectId,
      exists: true,
      projectRole: ['ana', 'dev'].includes(userId) ? 'designer' : null,
      managerUserId: 'pm',
      ownerUserId: 'owner',
    }),
    memberProjectIds: async () => ['project'],
    projectIdOfTask: async () => 'project',
    projectIdOfDeliverable: async () => 'project',
    projectIdOfMilestone: async () => 'project',
  };
  const stores: RewardWorldStores = {
    access,
    rewards,
    milestoneRewards,
    rewardChallenges,
    settings: fakeSettings(),
    records,
    notifications,
  };
  const uow: UnitOfWork<RewardWorldStores> = { stores, transaction: (work) => work(stores) };
  const notifierFor: NotifierFactory = async (bound) =>
    new Notifier(bound.notifications, bound.records, clock, {
      timeZone: 'Asia/Kolkata',
      quietHoursStart: '21:00',
      quietHoursEnd: '08:00',
      smsConfigured: false,
    });
  return {
    ctx,
    clock,
    uow,
    stores,
    rewards,
    milestoneRewards,
    rewardChallenges,
    records,
    notifications,
    notifierFor,
  };
}
