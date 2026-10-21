import { describe, expect, it } from 'vitest';
import type { UnitOfWork } from '../common/unit-of-work';
import { contextFor, InMemoryOperationsWorld } from '../testing/in-memory-operations.world';
import { fakeSettings, TEST_SETTINGS } from '../testing/leave-test-world';
import { WorkSessionCommands } from '../work/work-session.commands';
import { ManageSettingsCommands } from './manage-settings.commands';
import type { OrganizationSettings } from './settings.store';

function setup() {
  const world = new InMemoryOperationsWorld('2026-10-21T04:00:00Z');
  world.addProject('p1', 'pm', { ananya: 'designer', rohit: 'designer' });
  world.addTask({ id: 'measure', projectId: 'p1', ownerUserId: 'ananya' });
  world.addTask({ id: 'layout', projectId: 'p1', ownerUserId: 'rohit' });
  let current: OrganizationSettings = TEST_SETTINGS;
  const operations = world.stores();
  const stores = {
    settings: fakeSettings({
      organization: async () => current,
      updateOrganization: async (settings) => {
        current = settings;
        return current;
      },
    }),
    records: operations.records,
    workSessions: operations.workSessions,
    tasks: operations.tasks,
  };
  const uow: UnitOfWork<typeof stores> = { stores, transaction: (work) => work(stores) };
  const settings = new ManageSettingsCommands(uow, { now: () => world.clock.now() });
  const sessions = new WorkSessionCommands(world.dependencies(), {
    isEnabled: async () => current.workTrackingEnabled,
  });
  return { world, settings, sessions, current: () => current };
}

describe('switching work tracking off', () => {
  it('ends every running session, books its minutes and records how many closed', async () => {
    const { world, settings, sessions, current } = setup();
    await sessions.start(contextFor('ananya'), 'measure');
    await sessions.start(contextFor('rohit'), 'layout');
    world.setNow('2026-10-21T05:15:00Z');
    const admin = contextFor('admin', 'administrator');
    await settings.updateOrganization(admin, { ...current(), workTrackingEnabled: false });
    expect(world.sessions.every((session) => session.endedAt !== null)).toBe(true);
    expect(world.tasks.get('measure')?.actualMinutes).toBe(75);
    const audit = world.audit.find((entry) => entry.action === 'organization.updated');
    expect(audit?.after).toMatchObject({ workTrackingEnabled: false, closedWorkSessions: 2 });
    await expect(sessions.start(contextFor('ananya'), 'measure')).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
  });

  it('leaves sessions alone for other changes', async () => {
    const { world, settings, sessions, current } = setup();
    await sessions.start(contextFor('ananya'), 'measure');
    await settings.updateOrganization(contextFor('admin', 'administrator'), {
      ...current(),
      name: 'Renamed studio',
    });
    expect(world.sessions[0]?.endedAt).toBeNull();
    const audit = world.audit.find((entry) => entry.action === 'organization.updated');
    expect(audit?.after).not.toHaveProperty('closedWorkSessions');
  });

  it('needs the settings capability', async () => {
    const { settings, current } = setup();
    await expect(
      settings.updateOrganization(contextFor('ananya'), {
        ...current(),
        workTrackingEnabled: false,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
