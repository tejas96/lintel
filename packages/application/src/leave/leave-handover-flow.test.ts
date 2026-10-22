import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { leaveWorld } from '../testing/leave-test-world';
import { DecideHandoverCommand } from './decide-handover.command';
import { DecideLeaveRequestCommands } from './decide-leave-request.command';
import { LeaveQueries } from './leave.queries';
import { canSeeLeaveReason } from './leave-access';
import { RequestLeaveCommands } from './request-leave.command';

/** Ana asks for leave and proposes Dev to cover t1, a task on the PM's project. */
async function requestWithHandover() {
  const world = leaveWorld();
  world.leave.work.push({
    taskId: 't1',
    title: 'Produce 3D visualisations',
    projectId: 'project-pm',
    projectName: 'Mehta residence',
    projectCriticality: 'normal',
    projectManagerUserId: 'pm',
    status: 'in_progress',
    priority: 'medium',
    plannedStartDate: null,
    dueDate: toCalendarDate('2026-11-10'),
    milestoneName: null,
    milestoneDueDate: null,
    ownerUserId: 'ana',
    version: 1,
  });
  const { id } = await new RequestLeaveCommands(world.deps).submit(world.ctx('ana'), {
    leaveTypeId: 'earned',
    startDate: '2026-11-09',
    endDate: '2026-11-10',
    dayPortion: 'full',
    reason: 'Family wedding in Nashik',
    handovers: [{ taskId: 't1', toUserId: 'dev', note: null }],
  });
  const handoverId = world.leave.handovers[0]?.id ?? '';
  return { world, id, handoverId, handovers: new DecideHandoverCommand(world.deps) };
}

describe('who acts on a proposed handover', () => {
  it('asks the colleague at once and the project manager once the leave is approved', async () => {
    const { world, id } = await requestWithHandover();
    expect(world.notifications.to('dev')).toEqual(['handover_requested']);
    expect(world.notifications.to('pm')).toEqual([]);
    const request = await world.leave.findRequest(id);
    await new DecideLeaveRequestCommands(world.deps).decide(world.ctx('lead'), id, {
      decision: 'approve',
      note: null,
      version: request?.version ?? 0,
    });
    expect(world.leave.requests.find((item) => item.id === id)?.status).toBe('approved');
    expect(world.notifications.to('pm')).toEqual(['handover_requested']);
  });
});

describe('a handover handed back', () => {
  it('can be applied again only once the task is back with the person on leave', async () => {
    const { world, handoverId, handovers } = await requestWithHandover();
    const pm = world.ctx('pm');
    await handovers.execute(pm, handoverId, { decision: 'apply', toUserId: null });
    expect(world.leave.work[0]?.ownerUserId).toBe('dev');
    await expect(
      handovers.execute(pm, handoverId, { decision: 'apply', toUserId: 'lead' }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

    // A reassignment request gives the task back to Ana, onto her leave days.
    const work = world.leave.work[0];
    if (work) Object.assign(work, { ownerUserId: 'ana', version: work.version + 1 });
    await expect(
      handovers.execute(pm, handoverId, { decision: 'apply', toUserId: null }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await handovers.execute(pm, handoverId, { decision: 'apply', toUserId: 'lead' });
    expect(world.leave.work[0]?.ownerUserId).toBe('lead');
    expect(world.leave.handovers[0]).toMatchObject({ status: 'applied', toUserId: 'lead' });
    expect(world.records.audits.at(-1)?.after).toMatchObject({ handedBack: true });
  });
});

describe('leave reason privacy', () => {
  it('shows the reason to the person, their manager and approvers, not to cover or PMs', async () => {
    const { world, id } = await requestWithHandover();
    const queries = new LeaveQueries(world.deps.uow, world.deps.clock);
    const sees = async (userId: string) =>
      (await queries.detail(world.ctx(userId), id)).viewerCanSeeReason;
    expect(await sees('ana')).toBe(true);
    expect(await sees('lead')).toBe(true);
    expect(await sees('admin')).toBe(true);
    expect(await sees('dev')).toBe(false);
    expect(await sees('pm')).toBe(false);
  });

  it('follows the approvers and the recorder of an urgent absence', () => {
    const viewer = (userId: string) => ({ userId, capabilities: new Set<never>() });
    const facts = {
      requesterUserId: 'ana',
      requesterManagerUserId: 'lead',
      recordedByUserId: 'pm',
      approverUserIds: ['lead', 'owner', null],
    };
    expect(canSeeLeaveReason(viewer('owner'), facts)).toBe(true);
    expect(canSeeLeaveReason(viewer('pm'), facts)).toBe(true);
    expect(canSeeLeaveReason(viewer('dev'), facts)).toBe(false);
  });
});
