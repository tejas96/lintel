import type { Patch } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import type { UnitOfWork } from '../common/unit-of-work';
import { contextFor, fakePeople, person, RecordedEffects } from '../testing/leave-test-world';
import type { PeopleStore, PersonInput, PersonRecord } from './people.store';
import { type OwnProfileFields, UpdateOwnProfileCommand } from './update-own-profile.command';

function setup(status: PersonRecord['status'] = 'active') {
  const people = new Map<string, PersonRecord>([
    ['ana', person('ana', 'employee', { status, designation: 'Interior designer' })],
  ]);
  const updates: Patch<PersonInput>[] = [];
  const store: PeopleStore = {
    ...fakePeople([]),
    findById: async (id) => people.get(id) ?? null,
    update: async (id, version, changes) => {
      const current = people.get(id);
      if (!current || current.version !== version) return null;
      updates.push(changes);
      const next = { ...current, ...changes, version: version + 1 } as PersonRecord;
      people.set(id, next);
      return next;
    },
  };
  const records = new RecordedEffects();
  const stores = { people: store, records };
  const uow: UnitOfWork<typeof stores> = { stores, transaction: (work) => work(stores) };
  const ana = people.get('ana');
  if (!ana) throw new Error('missing test person');
  return { command: new UpdateOwnProfileCommand(uow), people, updates, records, ana };
}

describe('editing your own profile', () => {
  it('changes name, email and designation, trimmed, and audits what changed', async () => {
    const { command, records, ana } = setup();
    const after = await command.execute(contextFor(ana), {
      version: 1,
      changes: { fullName: '  Ananya J. ', email: 'ananya@studio.test', designation: '' },
    });
    expect(after).toMatchObject({
      fullName: 'Ananya J.',
      email: 'ananya@studio.test',
      designation: null,
      version: 2,
    });
    expect(records.audits[0]).toMatchObject({
      action: 'people.profile_updated',
      entityId: 'ana',
      before: { fullName: 'ana', email: null, designation: 'Interior designer' },
      after: { fullName: 'Ananya J.', email: 'ananya@studio.test', designation: null },
    });
  });

  it('never lets role, phone, status or team ride along', async () => {
    const { command, updates, people, ana } = setup();
    const sneaky = {
      designation: 'Lead designer',
      role: 'owner',
      phoneE164: '+919999999999',
      status: 'active',
      teamId: 'leadership',
      capacityPercent: 10,
    } as unknown as Patch<OwnProfileFields>;
    await command.execute(contextFor(ana), { version: 1, changes: sneaky });
    expect(updates).toEqual([{ designation: 'Lead designer' }]);
    expect(people.get('ana')).toMatchObject({
      role: 'employee',
      phoneE164: ana.phoneE164,
      teamId: 'design',
      capacityPercent: 100,
    });
  });

  it('refuses a stale version and explains invalid fields', async () => {
    const { command, ana } = setup();
    await expect(
      command.execute(contextFor(ana), { version: 7, changes: { designation: 'x' } }),
    ).rejects.toMatchObject({ code: 'STALE_VERSION' });
    await expect(
      command.execute(contextFor(ana), {
        version: 1,
        changes: { fullName: 'A', email: 'not-an-email' },
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [{ field: 'fullName' }, { field: 'email' }],
    });
  });

  it('writes nothing when nothing changes', async () => {
    const { command, updates, records, ana } = setup();
    const after = await command.execute(contextFor(ana), {
      version: 1,
      changes: { designation: 'Interior designer' },
    });
    expect(after.version).toBe(1);
    expect(updates).toHaveLength(0);
    expect(records.audits).toHaveLength(0);
  });

  it('is not available to a deactivated account', async () => {
    const { command, ana } = setup('deactivated');
    await expect(
      command.execute(contextFor(ana), { version: 1, changes: { designation: 'x' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
