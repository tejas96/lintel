import { describe, expect, it } from 'vitest';
import { type MilestoneWorkTask, milestoneContributors } from './milestone-contributors';

const task = (overrides: Partial<MilestoneWorkTask> & { id: string }): MilestoneWorkTask => ({
  milestoneId: null,
  parentTaskId: null,
  ownerUserId: null,
  finished: true,
  dependsOnTaskIds: [],
  submitterUserIds: [],
  ...overrides,
});

describe('milestone contributors', () => {
  it('credits the unlinked work a milestone task waits for (the site measurement)', () => {
    const tasks = [
      task({ id: 'brief', milestoneId: 'brief-signoff', ownerUserId: 'priya' }),
      task({ id: 'measure', ownerUserId: 'imran' }),
      task({
        id: 'survey-review',
        milestoneId: 'brief-signoff',
        ownerUserId: 'neha',
        dependsOnTaskIds: ['measure'],
      }),
    ];
    expect(milestoneContributors('brief-signoff', tasks).sort()).toEqual([
      'imran',
      'neha',
      'priya',
    ]);
  });

  it('follows unlinked chains and subtasks, but not work of another milestone', () => {
    const tasks = [
      task({
        id: 'present',
        milestoneId: 'concept',
        ownerUserId: 'dev',
        dependsOnTaskIds: ['plan'],
      }),
      task({ id: 'plan', ownerUserId: 'ana', dependsOnTaskIds: ['brief'] }),
      task({ id: 'brief', milestoneId: 'brief-signoff', ownerUserId: 'priya' }),
      task({ id: 'sketch', parentTaskId: 'present', ownerUserId: 'kiran' }),
      task({ id: 'open', parentTaskId: 'plan', ownerUserId: 'raj', finished: false }),
    ];
    expect(milestoneContributors('concept', tasks).sort()).toEqual(['ana', 'dev', 'kiran']);
  });

  it('credits deliverable submitters and skips owners of unfinished work', () => {
    const tasks = [
      task({
        id: 'brief',
        milestoneId: 'brief-signoff',
        ownerUserId: 'priya',
        finished: false,
        submitterUserIds: ['sameer'],
      }),
    ];
    expect(milestoneContributors('brief-signoff', tasks)).toEqual(['sameer']);
  });
});
