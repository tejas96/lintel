import { fixedClock } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import type { UnitOfWork } from '../common/unit-of-work';
import {
  fakePeople,
  fakeSettings,
  leaveWorld,
  person,
  TEST_NOW,
} from '../testing/leave-test-world';
import { CapacityQuery, type CapacityStores } from './capacity.query';
import type { CapacityReadStore, CapacityTaskRecord } from './capacity.store';
import { toTaskLoad } from './capacity-loads';

function setup() {
  const { people, ctx } = leaveWorld();
  people.push(person('site', 'site_supervisor', { teamId: 'site', reportsToUserId: 'pm' }));
  const tasks: CapacityTaskRecord[] = [
    {
      taskId: 't1',
      ownerUserId: 'ana',
      status: 'in_progress',
      estimateMinutes: 960,
      actualMinutes: 0,
      plannedStartDate: null,
      dueDate: '2026-10-22',
      hasOpenBlocker: false,
    },
    {
      taskId: 't2',
      ownerUserId: 'ana',
      status: 'draft',
      estimateMinutes: null,
      actualMinutes: 0,
      plannedStartDate: null,
      dueDate: '2026-10-21',
      hasOpenBlocker: false,
    },
  ];
  const capacity: CapacityReadStore = {
    people: async ({ userIds, teamId }) =>
      people
        .filter(
          (p) =>
            (userIds === null || userIds.includes(p.id)) &&
            (teamId === null || p.teamId === teamId),
        )
        .map((p) => ({
          user: {
            id: p.id,
            fullName: p.fullName,
            designation: null,
            role: p.role,
            avatarHue: 1,
            status: 'active' as const,
          },
          teamId: p.teamId,
          teamName: p.teamId,
          capacityPercent: p.capacityPercent,
        })),
    teamMemberIds: async (teamId) => people.filter((p) => p.teamId === teamId).map((p) => p.id),
    directReportIds: async (userId) =>
      people.filter((p) => p.reportsToUserId === userId).map((p) => p.id),
    leaveInRange: async () => [],
    openTaskLoads: async (userIds) => tasks.filter((task) => userIds.includes(task.ownerUserId)),
    coverPool: async () => [],
  };
  const stores = { capacity, people: fakePeople(people), settings: fakeSettings() };
  const uow: UnitOfWork<CapacityStores> = { stores, transaction: (work) => work(stores) };
  return { query: new CapacityQuery(uow, fixedClock(TEST_NOW)), ctx };
}

const week = { from: '2026-10-19', to: '2026-10-25' };
const names = (result: { people: readonly { user: { id: string } }[] }) =>
  result.people.map((row) => row.user.id).sort();

describe('capacity visibility', () => {
  it('shows an employee only themselves', async () => {
    const { query, ctx } = setup();
    expect(names(await query.execute(ctx('ana'), week))).toEqual(['ana']);
  });

  it('shows a team lead their team and direct reports', async () => {
    const { query, ctx } = setup();
    // The lead's team is design; the PM's reports include the site supervisor in another team.
    expect(names(await query.execute(ctx('lead'), week))).toEqual(['ana', 'dev', 'lead', 'pm']);
    expect(names(await query.execute(ctx('pm'), week))).toEqual([
      'ana',
      'dev',
      'lead',
      'pm',
      'site',
    ]);
  });

  it('shows everyone with capacity.view_all, optionally one team', async () => {
    const { query, ctx } = setup();
    expect(names(await query.execute(ctx('owner'), week))).toHaveLength(7);
    expect(names(await query.execute(ctx('owner'), { ...week, teamId: 'site' }))).toEqual(['site']);
    expect(names(await query.execute(ctx('lead'), { ...week, teamId: 'site' }))).toEqual([]);
  });

  it('refuses ranges longer than 62 days or reversed', async () => {
    const { query, ctx } = setup();
    await expect(
      query.execute(ctx('owner'), { from: '2026-10-01', to: '2026-12-02' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      query.execute(ctx('owner'), { from: '2026-10-02', to: '2026-10-01' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

describe('capacity loads', () => {
  it('spreads remaining effort, flags default estimates and keeps drafts tentative', async () => {
    const { query, ctx } = setup();
    const [ana] = (await query.execute(ctx('ana'), week)).people;
    expect(ana).toMatchObject({
      openTaskCount: 2,
      usesDefaultEstimates: true,
      tentativeMinutes: 120,
    });
    // 960 minutes over Wed 21 and Thu 22 → 480 each, which fills both days.
    expect(ana?.days.find((day) => day.date === '2026-10-21')).toMatchObject({
      confirmedMinutes: 480,
      tentativeMinutes: 120,
    });
    expect(ana?.confirmedMinutes).toBe(960);
  });

  it('never counts negative remaining effort and separates blocked work', () => {
    expect(
      toTaskLoad({
        taskId: 't',
        ownerUserId: 'a',
        status: 'in_progress',
        estimateMinutes: 60,
        actualMinutes: 90,
        plannedStartDate: null,
        dueDate: null,
        hasOpenBlocker: true,
      }),
    ).toMatchObject({
      remainingMinutes: 0,
      isBlocked: true,
      commitment: 'confirmed',
      estimateIsDefault: false,
    });
  });
});
