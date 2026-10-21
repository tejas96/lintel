import { describe, expect, it } from 'vitest';
import { leaveWorld } from '../testing/leave-test-world';
import { DecideLeaveRequestCommands } from './decide-leave-request.command';
import { LeaveQueries } from './leave.queries';
import { RequestLeaveCommands } from './request-leave.command';

const earnedLeave = {
  leaveTypeId: 'earned',
  startDate: '2026-11-09',
  endDate: '2026-11-10',
  dayPortion: 'full' as const,
  reason: 'Family wedding',
  handovers: [],
};

function setup() {
  const world = leaveWorld();
  const retire = () => {
    world.leave.types.splice(
      0,
      world.leave.types.length,
      ...world.leave.types.map((type) => ({ ...type, isActive: false })),
    );
  };
  return {
    ...world,
    retire,
    request: new RequestLeaveCommands(world.deps),
    decide: new DecideLeaveRequestCommands(world.deps),
    queries: new LeaveQueries(world.deps.uow, world.deps.clock),
  };
}

describe('retiring a leave type', () => {
  it('keeps requests already made with it working end to end', async () => {
    const { request, decide, queries, ctx, leave, retire } = setup();
    const { id } = await request.submit(ctx('ana'), earnedLeave);
    retire();
    const detail = await queries.detail(ctx('lead'), id);
    expect(detail.impact.blockingProblems).toEqual([]);
    await decide.decide(ctx('lead'), id, { decision: 'request_info', note: 'Cover?', version: 1 });
    await decide.respond(ctx('ana'), id, { reason: 'Dev covers it', handovers: [], version: 2 });
    await decide.decide(ctx('lead'), id, { decision: 'approve', note: null, version: 3 });
    expect((await leave.findRequest(id))?.status).toBe('approved');
  });

  it('cannot be chosen for a new request', async () => {
    const { request, ctx, retire } = setup();
    retire();
    await expect(request.submit(ctx('ana'), earnedLeave)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'This leave type is no longer offered.',
    });
    const preview = await request.preview(ctx('ana'), { ...earnedLeave, userId: null });
    expect(preview.blockingProblems).toContain('This leave type is no longer offered.');
  });
});
