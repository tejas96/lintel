import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { leaveWorld } from '../testing/leave-test-world';
import { CancelLeaveRequestCommand } from './cancel-leave-request.command';
import { DecideLeaveRequestCommands } from './decide-leave-request.command';
import { LeaveQueries } from './leave.queries';
import { RequestLeaveCommands } from './request-leave.command';

// "Today" is Wednesday 21 October 2026; 26 Oct–2 Nov is 7 working days (14 half-days > 10).
const longLeave = {
  leaveTypeId: 'earned',
  startDate: '2026-10-26',
  endDate: '2026-11-02',
  dayPortion: 'full' as const,
  reason: 'Family wedding',
  handovers: [],
};
const shortLeave = { ...longLeave, startDate: '2026-11-09', endDate: '2026-11-10' };

function setup() {
  const world = leaveWorld();
  const request = new RequestLeaveCommands(world.deps);
  const decide = new DecideLeaveRequestCommands(world.deps);
  const cancel = new CancelLeaveRequestCommand(world.deps);
  const queries = new LeaveQueries(world.deps.uow, world.deps.clock);
  const stepsOf = async (id: string) =>
    (await world.leave.findRequest(id))?.steps.map((s) => `${s.approverUserId}:${s.status}`);
  return { ...world, request, decide, cancel, queries, stepsOf };
}

describe('leave approval flow', () => {
  it('routes a long request through the lead and then the owner', async () => {
    const { request, decide, ctx, stepsOf, notifications, records, leave } = setup();
    const { id } = await request.submit(ctx('ana'), longLeave);
    expect(await stepsOf(id)).toEqual(['lead:pending', 'owner:waiting']);
    expect(notifications.to('lead')).toEqual(['leave_requested']);

    await decide.decide(ctx('lead'), id, { decision: 'approve', note: 'Fine', version: 1 });
    expect(await stepsOf(id)).toEqual(['lead:approved', 'owner:pending']);
    expect((await leave.findRequest(id))?.status).toBe('pending');
    expect(notifications.to('owner')).toEqual(['leave_requested']);

    await decide.decide(ctx('owner'), id, { decision: 'approve', note: 'Enjoy', version: 2 });
    expect((await leave.findRequest(id))?.status).toBe('approved');
    expect(notifications.to('ana')).toEqual(['leave_decided']);
    expect(records.events).toEqual(['LeaveRequested', 'LeaveDecided', 'LeaveDecided']);
    expect(records.audits.map((audit) => audit.action)).toEqual([
      'leave.requested',
      'leave.approve',
      'leave.approve',
    ]);
  });

  it('lets exactly one of two concurrent decisions win', async () => {
    const { request, decide, ctx, leave } = setup();
    const { id } = await request.submit(ctx('ana'), shortLeave);
    const results = await Promise.allSettled([
      decide.decide(ctx('lead'), id, { decision: 'approve', note: null, version: 1 }),
      decide.decide(ctx('owner'), id, { decision: 'reject', note: 'No', version: 1 }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    const failure = results.find((result) => result.status === 'rejected');
    expect(failure?.status === 'rejected' && failure.reason).toMatchObject({
      code: 'STALE_VERSION',
    });
    expect((await leave.findRequest(id))?.version).toBe(2);
  });

  it('refuses people who are not the current approver and hides the request from strangers', async () => {
    const { request, decide, ctx, queries } = setup();
    const { id } = await request.submit(ctx('ana'), longLeave);
    await expect(
      decide.decide(ctx('admin'), id, { decision: 'approve', note: null, version: 1 }),
    ).resolves.toBeUndefined();
    await expect(
      decide.decide(ctx('pm'), id, { decision: 'approve', note: null, version: 2 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(queries.detail(ctx('dev'), id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      decide.decide(ctx('ana'), id, { decision: 'approve', note: null, version: 2 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('round-trips a request for more information', async () => {
    const { request, decide, ctx, leave, notifications } = setup();
    const { id } = await request.submit(ctx('ana'), shortLeave);
    await decide.decide(ctx('lead'), id, { decision: 'request_info', note: 'Cover?', version: 1 });
    expect((await leave.findRequest(id))?.status).toBe('info_requested');
    expect(notifications.to('ana')).toEqual(['leave_info_requested']);
    await decide.respond(ctx('ana'), id, { reason: 'Dev covers it', handovers: [], version: 2 });
    expect((await leave.findRequest(id))?.status).toBe('pending');
    expect(notifications.to('lead')).toEqual(['leave_requested', 'leave_requested']);
    await decide.decide(ctx('lead'), id, { decision: 'approve', note: null, version: 3 });
    expect((await leave.findRequest(id))?.status).toBe('approved');
  });

  it('blocks overlapping requests and missing reasons, but never conflicts alone', async () => {
    const { request, ctx, leave } = setup();
    leave.work.push({
      taskId: 't1',
      title: 'Design freeze pack',
      projectId: 'p1',
      projectName: 'Saska',
      projectCriticality: 'critical',
      projectManagerUserId: 'pm',
      status: 'in_progress',
      priority: 'urgent',
      plannedStartDate: null,
      dueDate: toCalendarDate('2026-11-09'),
      milestoneName: null,
      milestoneDueDate: null,
      ownerUserId: 'ana',
      version: 1,
    });
    const { id } = await request.submit(ctx('ana'), shortLeave);
    expect((await leave.findRequest(id))?.steps).toHaveLength(2);
    await expect(request.submit(ctx('ana'), shortLeave)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'These dates overlap another leave request of yours.',
    });
    await expect(request.submit(ctx('dev'), { ...shortLeave, reason: null })).rejects.toMatchObject(
      { message: 'This leave type needs a reason.' },
    );
  });
});

describe('leave cancellation', () => {
  it('lets the requester cancel before the start and audits it', async () => {
    const { request, cancel, ctx, leave, records, stepsOf } = setup();
    const { id } = await request.submit(ctx('ana'), shortLeave);
    await cancel.execute(ctx('ana'), id, { note: 'Plans changed', version: 1 });
    expect((await leave.findRequest(id))?.status).toBe('cancelled');
    expect(await stepsOf(id)).toEqual(['lead:skipped']);
    expect(records.audits.at(-1)?.action).toBe('leave.cancelled');
  });

  it('only leave managers may cancel leave that has started', async () => {
    const { request, decide, cancel, ctx, leave } = setup();
    const { id } = await request.submit(ctx('ana'), { ...shortLeave, startDate: '2026-11-09' });
    await decide.decide(ctx('lead'), id, { decision: 'approve', note: null, version: 1 });
    const stored = leave.requests.find((candidate) => candidate.id === id);
    if (stored) Object.assign(stored, { startDate: '2026-10-20' });
    await expect(cancel.execute(ctx('ana'), id, { note: null, version: 2 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await cancel.execute(ctx('owner'), id, { note: 'Workshop moved', version: 2 });
    expect((await leave.findRequest(id))?.status).toBe('cancelled');
    await expect(
      cancel.execute(ctx('owner'), id, { note: null, version: 3 }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });
});
