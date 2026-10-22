import { fixedClock } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import type { UnitOfWork } from '../common/unit-of-work';
import { InMemoryTeamStore } from '../testing/in-memory-team.store';
import {
  contextFor,
  fakePeople,
  person,
  RecordedEffects,
  TEST_NOW,
} from '../testing/leave-test-world';
import { ManageTeamsCommands } from './manage-teams.commands';

const admin = contextFor(person('admin', 'administrator'));
const designer = contextFor(person('ana', 'employee'));
const design = { name: '  Design ', description: '  ', leadUserId: null };

function setup() {
  const teams = new InMemoryTeamStore();
  const records = new RecordedEffects();
  const people = fakePeople([
    person('lead', 'team_lead'),
    person('gone', 'employee', { status: 'deactivated' }),
  ]);
  const stores = { teams, people, records };
  const uow: UnitOfWork<typeof stores> = { stores, transaction: (work) => work(stores) };
  return { teams, records, commands: new ManageTeamsCommands(uow, fixedClock(TEST_NOW)) };
}

describe('team administration', () => {
  it('creates a tidy team and audits it', async () => {
    const { commands, records } = setup();
    const created = await commands.create(admin, design);
    expect(created).toMatchObject({ name: 'Design', description: null, version: 1 });
    expect(records.audits[0]).toMatchObject({ action: 'team.created', entityId: created.id });
  });

  it('needs users.manage', async () => {
    const { commands } = setup();
    await expect(commands.create(designer, design)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses a name another team uses, whatever the case, archived teams included', async () => {
    const { commands } = setup();
    const first = await commands.create(admin, design);
    await commands.setActive(admin, first.id, first.version, false);
    await expect(commands.create(admin, { ...design, name: 'DESIGN' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('renames and sets an active lead, auditing only what changed', async () => {
    const { commands, records } = setup();
    const team = await commands.create(admin, design);
    const renamed = await commands.update(admin, team.id, team.version, {
      name: 'Interiors',
      leadUserId: 'lead',
    });
    expect(renamed).toMatchObject({ name: 'Interiors', leadUserId: 'lead', version: 2 });
    expect(records.audits[1]).toMatchObject({
      action: 'team.updated',
      before: { name: 'Design', leadUserId: null },
      after: { name: 'Interiors', leadUserId: 'lead' },
    });
  });

  it('refuses a deactivated or unknown lead and a stale version', async () => {
    const { commands } = setup();
    const team = await commands.create(admin, design);
    await expect(
      commands.update(admin, team.id, team.version, { leadUserId: 'gone' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      commands.create(admin, { ...design, name: 'Site', leadUserId: 'nobody' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(commands.update(admin, team.id, 9, { name: 'Site' })).rejects.toMatchObject({
      code: 'STALE_VERSION',
    });
  });

  it('archives only an empty team, and brings it back', async () => {
    const { commands, teams, records } = setup();
    const team = await commands.create(admin, design);
    teams.members.set(team.id, 2);
    await expect(commands.setActive(admin, team.id, 1, false)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: expect.stringContaining('2 people'),
    });
    teams.members.set(team.id, 0);
    const archived = await commands.setActive(admin, team.id, 1, false);
    expect(archived.archivedAt?.toISOString()).toBe(new Date(TEST_NOW).toISOString());
    const restored = await commands.setActive(admin, team.id, archived.version, true);
    expect(restored.archivedAt).toBeNull();
    expect(records.audits.map((audit) => audit.action)).toEqual([
      'team.created',
      'team.archived',
      'team.restored',
    ]);
  });
});
