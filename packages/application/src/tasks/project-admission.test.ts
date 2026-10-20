import { describe, expect, it } from 'vitest';
import { contextFor, InMemoryOperationsWorld } from '../testing/in-memory-operations.world';
import { AssignTaskCommands } from './assign-task.command';

function setup() {
  const world = new InMemoryOperationsWorld();
  world.addProject('p1', 'pm', { ananya: 'designer', lead: 'reviewer' });
  world.activeUsers.add('outsider');
  world.addTask({ id: 'layout', projectId: 'p1', ownerUserId: 'ananya', status: 'ready' });
  return { world, assign: new AssignTaskCommands(world.dependencies()) };
}

describe('adding people to a project through task work', () => {
  it('lets a reviewer who can assign work reassign only to existing members', async () => {
    const { world, assign } = setup();
    const reviewer = contextFor('lead', 'team_lead');
    await expect(
      assign.assign(reviewer, 'layout', { ownerUserId: 'outsider', reason: null, version: 1 }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    await expect(assign.setCollaborators(reviewer, 'layout', ['outsider'])).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
    expect(world.projects.get('p1')?.members.has('outsider')).toBe(false);
  });

  it('lets the project manager bring someone new onto the project', async () => {
    const { world, assign } = setup();
    await assign.assign(contextFor('pm', 'project_manager'), 'layout', {
      ownerUserId: 'outsider',
      reason: 'Extra hands',
      version: 1,
    });
    expect(world.projects.get('p1')?.members.has('outsider')).toBe(true);
  });
});
