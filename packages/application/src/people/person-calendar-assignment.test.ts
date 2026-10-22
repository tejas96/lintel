import { fixedClock, type Patch } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import { InMemoryCalendarStore } from '../testing/in-memory-calendar.store';
import { contextFor, fakePeople, person, RecordedEffects } from '../testing/leave-test-world';
import { ManagePeopleCommands } from './manage-people.commands';
import type { PeopleStore, PersonInput, PersonRecord } from './people.store';

function setup() {
  const people = new Map<string, PersonRecord>([['ana', person('ana', 'employee')]]);
  const store: PeopleStore = {
    ...fakePeople([]),
    findById: async (id) => people.get(id) ?? null,
    phoneInUse: async () => false,
    teamIsOpen: async () => true,
    update: async (id, version, changes: Patch<PersonInput>) => {
      const current = people.get(id);
      if (!current || current.version !== version) return null;
      const next = { ...current, ...changes, version: version + 1 } as PersonRecord;
      people.set(id, next);
      return next;
    },
  };
  const calendars = new InMemoryCalendarStore();
  const studio = calendars.calendars[0];
  if (!studio) throw new Error('The test store starts with the studio week.');
  calendars.calendars.push({
    ...studio,
    id: 'part-time',
    name: 'Part time',
    isDefault: false,
    workingWeekdays: [1, 2, 3],
  });
  const records = new RecordedEffects();
  const stores = { people: store, calendars, records } as unknown as ApplicationStores;
  const uow: UnitOfWork<ApplicationStores> = { stores, transaction: (work) => work(stores) };
  const commands = new ManagePeopleCommands(uow, fixedClock('2026-10-21T05:00:00Z'));
  return { commands, people, records };
}

describe('assigning a working week to a person', () => {
  const admin = contextFor(person('admin', 'administrator'));

  it('moves the person to another working week and audits it', async () => {
    const { commands, people, records } = setup();
    await commands.update(admin, 'ana', 1, { workingCalendarId: 'part-time' });
    expect(people.get('ana')?.workingCalendarId).toBe('part-time');
    expect(records.audits[0]).toMatchObject({
      action: 'people.updated',
      before: { workingCalendarId: null },
      after: { workingCalendarId: 'part-time' },
    });
  });

  it('refuses a working week that does not exist', async () => {
    const { commands } = setup();
    await expect(
      commands.update(admin, 'ana', 1, { workingCalendarId: 'missing' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [{ field: 'workingCalendarId' }],
    });
  });
});
