import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { leaveWorld } from '../testing/leave-test-world';
import { DecideHandoverCommand } from './decide-handover.command';
import { LeaveQueries } from './leave.queries';
import type { LeaveWorkItem } from './leave.store';
import { RecordUrgentAbsenceCommand } from './record-urgent-absence.command';
import { RequestLeaveCommands } from './request-leave.command';

function task(
  taskId: string,
  ownerUserId: string,
  projectManagerUserId: string,
  dueDate: string,
): LeaveWorkItem & { ownerUserId: string; version: number } {
  return {
    taskId,
    title: `Task ${taskId}`,
    projectId: `project-${projectManagerUserId}`,
    projectName: `Project of ${projectManagerUserId}`,
    projectCriticality: 'normal',
    projectManagerUserId,
    status: 'in_progress',
    priority: 'medium',
    plannedStartDate: null,
    dueDate: toCalendarDate(dueDate),
    milestoneName: null,
    milestoneDueDate: null,
    ownerUserId,
    version: 1,
  };
}

const absence = {
  leaveTypeId: 'earned',
  startDate: '2026-10-21',
  endDate: '2026-10-23',
  dayPortion: 'full' as const,
  userId: 'dev',
  reason: 'High fever',
};

describe('urgent absence', () => {
  it('is approved at once and asks every affected project manager to reassess', async () => {
    const world = leaveWorld();
    world.leave.work.push(
      task('t1', 'dev', 'pm', '2026-10-22'),
      task('t2', 'dev', 'owner', '2026-10-23'),
    );
    world.leave.work.push(task('t3', 'dev', 'pm', '2026-12-01'));
    const { id } = await new RecordUrgentAbsenceCommand(world.deps).execute(
      world.ctx('pm'),
      absence,
    );
    const stored = await world.leave.findRequest(id);
    expect(stored).toMatchObject({
      status: 'approved',
      isUrgentAbsence: true,
      recordedByUserId: 'pm',
    });
    expect(world.notifications.to('pm')).toEqual(['absence_reassessment']);
    expect(world.notifications.to('owner')).toEqual(['absence_reassessment']);
    expect(world.notifications.to('dev')).toEqual(['leave_decided']);
    const ownerNote = world.notifications.sent.find((n) => n.recipientUserId === 'owner');
    expect(ownerNote?.body).toContain('Task t2');
    expect(ownerNote?.body).not.toContain('Task t1');
    // Nothing is reassigned automatically.
    expect(world.leave.work.map((item) => item.ownerUserId)).toEqual(['dev', 'dev', 'dev']);
    expect(world.records.events).toEqual(['UrgentAbsenceRecorded']);
  });

  it('needs leave.record_absence and a relationship with the person', async () => {
    const world = leaveWorld();
    const command = new RecordUrgentAbsenceCommand(world.deps);
    await expect(command.execute(world.ctx('lead'), absence)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    const outsider = world.people.find((candidate) => candidate.id === 'dev');
    // Outside the project manager's reporting line (reports to the administrator).
    if (outsider) Object.assign(outsider, { teamId: 'site', reportsToUserId: 'admin' });
    await expect(command.execute(world.ctx('pm'), absence)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(command.execute(world.ctx('admin'), absence)).resolves.toHaveProperty('id');
  });
});

describe('handovers', () => {
  async function requestWithHandover() {
    const world = leaveWorld();
    world.leave.work.push(task('t1', 'ana', 'pm', '2026-11-10'));
    const { id } = await new RequestLeaveCommands(world.deps).submit(world.ctx('ana'), {
      leaveTypeId: 'earned',
      startDate: '2026-11-09',
      endDate: '2026-11-10',
      dayPortion: 'full',
      reason: 'Exam',
      handovers: [{ taskId: 't1', toUserId: 'dev', note: 'Notes in the folder' }],
    });
    const handover = world.leave.handovers[0];
    if (!handover) throw new Error('No handover stored.');
    return { world, id, handoverId: handover.id, command: new DecideHandoverCommand(world.deps) };
  }

  it('notifies the proposed person, who accepts it', async () => {
    const { world, handoverId, command } = await requestWithHandover();
    expect(world.notifications.to('dev')).toEqual(['handover_requested']);
    await expect(
      command.execute(world.ctx('lead'), handoverId, { decision: 'accept', toUserId: null }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await command.execute(world.ctx('dev'), handoverId, { decision: 'accept', toUserId: null });
    expect(world.leave.handovers[0]?.status).toBe('accepted');
  });

  it('is applied by the project manager: reassigned, audited, announced', async () => {
    const { world, id, handoverId, command } = await requestWithHandover();
    await expect(
      command.execute(world.ctx('dev'), handoverId, { decision: 'apply', toUserId: null }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await command.execute(world.ctx('pm'), handoverId, { decision: 'apply', toUserId: null });
    expect(world.leave.work[0]?.ownerUserId).toBe('dev');
    expect(world.leave.handovers[0]?.status).toBe('applied');
    expect(world.records.audits.at(-1)?.action).toBe('task.reassigned_for_leave');
    expect(world.records.activity).toEqual(['task.reassigned']);
    expect(world.records.events.at(-1)).toBe('TaskAssigned');
    expect(world.notifications.to('dev')).toEqual(['handover_requested', 'task_assigned']);
    expect(world.notifications.to('ana')).toEqual(['task_reassigned']);
    const detail = await new LeaveQueries(world.deps.uow, world.deps.clock).detail(
      world.ctx('pm'),
      id,
    );
    expect(detail.request.handovers[0]?.status).toBe('applied');
  });
});

describe('urgent absence permissions', () => {
  it('cannot be used to approve your own leave', async () => {
    const world = leaveWorld();
    await expect(
      new RecordUrgentAbsenceCommand(world.deps).execute(world.ctx('pm'), {
        ...absence,
        userId: 'pm',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('is limited to the reporting line (or leave.approve_any)', async () => {
    const world = leaveWorld();
    // "ana" is dev's peer, not their manager, even if granted the capability.
    const peer = world.ctx('ana');
    const withCapability = {
      ...peer,
      actor: {
        ...peer.actor,
        capabilities: new Set([...peer.actor.capabilities, 'leave.record_absence' as const]),
      },
    };
    await expect(
      new RecordUrgentAbsenceCommand(world.deps).execute(withCapability, absence),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
