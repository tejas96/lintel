import { describe, expect, it } from 'vitest';
import { contextFor, InMemoryOperationsWorld } from '../testing/in-memory-operations.world';
import { UpdateTaskCommand } from './update-task.command';

function setup() {
  const world = new InMemoryOperationsWorld();
  world.addProject('p1', 'pm', { ananya: 'designer' });
  world.addTask({ id: 'drawings', projectId: 'p1', ownerUserId: 'ananya' });
  return { world, command: new UpdateTaskCommand(world.dependencies()) };
}

describe('per-task escalation timing', () => {
  it('lets the project manager change it and asks the deadline workflow to re-plan', async () => {
    const { world, command } = setup();
    const after = await command.execute(contextFor('pm', 'project_manager'), 'drawings', {
      version: 1,
      changes: { escalateAfterOverdueDays: 3 },
    });
    expect(after.escalateAfterOverdueDays).toBe(3);
    expect(world.events.map((event) => event.type)).toEqual(['TaskScheduleChanged']);
    expect(world.events[0]?.payload).toMatchObject({ taskId: 'drawings', dueDate: '2026-10-25' });
    const audit = world.audit.find((entry) => entry.action === 'task.updated');
    expect(audit?.before).toEqual({ escalateAfterOverdueDays: 1 });
  });

  it('is a manager decision: the task owner cannot change it', async () => {
    const { world, command } = setup();
    await expect(
      command.execute(contextFor('ananya'), 'drawings', {
        version: 1,
        changes: { escalateAfterOverdueDays: 5 },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(world.tasks.get('drawings')?.escalateAfterOverdueDays).toBe(1);
  });

  it('refuses values outside 1 to 30 working days', async () => {
    const { command } = setup();
    for (const days of [0, 31, 1.5]) {
      await expect(
        command.execute(contextFor('pm', 'project_manager'), 'drawings', {
          version: 1,
          changes: { escalateAfterOverdueDays: days },
        }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        details: [{ field: 'escalateAfterOverdueDays' }],
      });
    }
  });

  it('re-plans when the priority changes, and stays quiet for other edits', async () => {
    const { world, command } = setup();
    const pm = contextFor('pm', 'project_manager');
    await command.execute(pm, 'drawings', { version: 1, changes: { title: 'Final drawings' } });
    expect(world.events).toHaveLength(0);
    await command.execute(pm, 'drawings', { version: 2, changes: { priority: 'urgent' } });
    expect(world.events.map((event) => event.type)).toEqual(['TaskScheduleChanged']);
  });

  it('changes nothing when the value is the same', async () => {
    const { world, command } = setup();
    const after = await command.execute(contextFor('pm', 'project_manager'), 'drawings', {
      version: 1,
      changes: { escalateAfterOverdueDays: 1 },
    });
    expect(after.version).toBe(1);
    expect(world.events).toHaveLength(0);
  });
});
