import { describe, expect, it } from 'vitest';
import { TransitionTaskCommand } from '../tasks/transition-task.command';
import { contextFor, InMemoryOperationsWorld } from '../testing/in-memory-operations.world';
import { WorkSessionCommands } from './work-session.commands';

function setup(tracking = { enabled: true }) {
  const world = new InMemoryOperationsWorld('2026-10-21T04:00:00Z');
  world.addProject('p1', 'pm', { ananya: 'designer', rohit: 'designer' });
  world.addTask({ id: 'measure', projectId: 'p1', ownerUserId: 'ananya', estimateMinutes: 180 });
  world.addTask({ id: 'layout', projectId: 'p1', ownerUserId: 'rohit', status: 'in_progress' });
  world.collaborators.set('layout', ['ananya']);
  world.addTask({ id: 'draft', projectId: 'p1', ownerUserId: 'ananya', status: 'draft' });
  const sessions = new WorkSessionCommands(world.dependencies(), {
    isEnabled: async () => tracking.enabled,
  });
  return { world, sessions, tracking, ananya: contextFor('ananya') };
}

describe('work sessions', () => {
  it('starting a ready task moves it to in progress through the transition rules', async () => {
    const { world, sessions, ananya } = setup();
    await sessions.start(ananya, 'measure');
    const task = world.tasks.get('measure');
    expect(task?.status).toBe('in_progress');
    expect(task?.startedAt?.toISOString()).toBe('2026-10-21T04:00:00.000Z');
    expect(task?.acknowledgedAt).not.toBeNull();
    expect(world.sessions).toHaveLength(1);
    expect(world.audit.map((entry) => entry.action)).toContain('task.status_changed');
  });

  it('keeps one running session per person and books the paused minutes', async () => {
    const { world, sessions, ananya } = setup();
    await sessions.start(ananya, 'measure');
    world.setNow('2026-10-21T05:30:00Z');
    await sessions.start(ananya, 'layout');
    expect(world.tasks.get('measure')?.actualMinutes).toBe(90);
    const running = world.sessions.filter((session) => session.endedAt === null);
    expect(running.map((session) => session.taskId)).toEqual(['layout']);
    world.setNow('2026-10-21T06:15:30Z');
    await sessions.pause(ananya, 'layout');
    expect(world.tasks.get('layout')?.actualMinutes).toBe(46);
    expect(world.sessions.every((session) => session.endedAt !== null)).toBe(true);
  });

  it('starting the running task again changes nothing', async () => {
    const { world, sessions, ananya } = setup();
    await sessions.start(ananya, 'measure');
    await sessions.start(ananya, 'measure');
    expect(world.sessions).toHaveLength(1);
    expect(world.tasks.get('measure')?.version).toBe(2);
  });

  it('closes running sessions when the task leaves in progress', async () => {
    const { world, sessions, ananya } = setup();
    await sessions.start(ananya, 'measure');
    world.setNow('2026-10-21T06:00:00Z');
    await new TransitionTaskCommand(world.dependencies()).execute(ananya, 'measure', {
      to: 'ready',
      note: null,
      version: 2,
    });
    expect(world.sessions[0]?.endedAt?.toISOString()).toBe('2026-10-21T06:00:00.000Z');
    expect(world.tasks.get('measure')?.actualMinutes).toBe(120);
  });

  it('refuses drafts, other people’s tasks and pausing without a session', async () => {
    const { sessions, ananya } = setup();
    await expect(sessions.start(ananya, 'draft')).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
    await expect(
      sessions.start(contextFor('pm', 'project_manager'), 'measure'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(sessions.start(contextFor('stranger'), 'measure')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(sessions.pause(ananya, 'measure')).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
  });

  it('refuses to start or pause while the studio does not track working time', async () => {
    const { world, sessions, tracking, ananya } = setup();
    await sessions.start(ananya, 'measure');
    tracking.enabled = false;
    for (const action of [
      () => sessions.start(ananya, 'layout'),
      () => sessions.pause(ananya, 'measure'),
    ]) {
      await expect(action()).rejects.toMatchObject({
        code: 'PRECONDITION_FAILED',
        message: expect.stringMatching(/Work tracking is switched off/),
        details: [{ message: expect.stringMatching(/Move the task with its status instead/) }],
      });
    }
    expect(world.sessions).toHaveLength(1);
    expect(world.tasks.get('layout')?.version).toBe(1);
  });
});
