import { describe, expect, it } from 'vitest';
import { contextFor, InMemoryOperationsWorld } from '../testing/in-memory-operations.world';
import { TaskBlockerCommands } from './task-blocker.commands';

function setup() {
  const world = new InMemoryOperationsWorld();
  world.addProject('p1', 'pm', { ananya: 'designer', site: 'site_supervisor', rohit: 'designer' });
  world.addTask({ id: 'layout', projectId: 'p1', ownerUserId: 'ananya', status: 'in_progress' });
  return { world, blockers: new TaskBlockerCommands(world.dependencies()) };
}

const report = (reason: string, waitingOnUserId: string | null, version: number) => ({
  category: 'supplier' as const,
  reason,
  waitingOnUserId,
  version,
});

describe('blockers', () => {
  it('blocks the task, alerts the manager and the person waited on, and emits TaskBlocked', async () => {
    const { world, blockers } = setup();
    await blockers.report(contextFor('ananya'), 'layout', report('Catalogue missing', 'site', 1));
    expect(world.tasks.get('layout')?.status).toBe('blocked');
    expect(world.notifications.map((n) => [n.recipientUserId, n.kind])).toEqual([
      ['pm', 'task_blocked'],
      ['site', 'task_blocked'],
    ]);
    expect(world.events.map((event) => event.type)).toEqual(['TaskBlocked']);
  });

  it('resuming waits until the last blocker is resolved, even when the person waited on resolves it', async () => {
    const { world, blockers } = setup();
    await blockers.report(contextFor('ananya'), 'layout', report('Catalogue missing', 'site', 1));
    await blockers.report(contextFor('ananya'), 'layout', report('Need fixture sign-off', null, 2));
    const [first, second] = world.blockers;
    await blockers.resolve(contextFor('site', 'site_supervisor'), first?.id ?? '', {
      resolution: 'Catalogue shared',
      resumeWork: true,
    });
    expect(world.tasks.get('layout')?.status).toBe('blocked');
    await expect(
      blockers.resolve(contextFor('rohit'), second?.id ?? '', {
        resolution: 'Not mine',
        resumeWork: true,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await blockers.resolve(contextFor('pm', 'project_manager'), second?.id ?? '', {
      resolution: 'Approved',
      resumeWork: true,
    });
    expect(world.tasks.get('layout')?.status).toBe('in_progress');
    expect(world.events.map((event) => event.type)).toEqual([
      'TaskBlocked',
      'TaskBlocked',
      'TaskUnblocked',
      'TaskUnblocked',
    ]);
    await expect(
      blockers.resolve(contextFor('pm', 'project_manager'), second?.id ?? '', {
        resolution: 'Again',
        resumeWork: false,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('only the owner, collaborators or managers can block, and only from a legal status', async () => {
    const { world, blockers } = setup();
    await expect(
      blockers.report(contextFor('rohit'), 'layout', report('Not my task', null, 1)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    world.addTask({ id: 'done', projectId: 'p1', ownerUserId: 'ananya', status: 'done' });
    await expect(
      blockers.report(contextFor('ananya'), 'done', report('Too late', null, 1)),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });
});
