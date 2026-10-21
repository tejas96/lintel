import { CAPABILITIES } from '@lintel/domain';
import { describe, expect, it } from 'vitest';
import type { UnitOfWork } from '../common/unit-of-work';
import { RecordedEffects } from '../testing/leave-test-world';
import {
  SetUpStudioCommand,
  type SetupStores,
  type StudioSetupInput,
} from './set-up-studio.command';
import type { NewStudioOwner, NewStudioSettings, StudioSetupStore } from './studio-setup.store';

class InMemorySetupStore implements StudioSetupStore {
  settings: NewStudioSettings | null = null;
  calendars: { id: string; name: string; workingMinutesPerDay: number }[] = [];
  grants = new Set<string>();
  owners: (NewStudioOwner & { id: string })[] = [];
  phones = new Set<string>();
  locks = 0;

  async lock() {
    this.locks += 1;
  }
  async state(phone: string) {
    return {
      settingsConfigured: this.settings !== null,
      ownerExists: this.owners.length > 0,
      defaultCalendarExists: this.calendars.length > 0,
      ownerPhoneInUse: this.phones.has(phone),
    };
  }
  async createSettings(settings: NewStudioSettings) {
    this.settings = settings;
  }
  async createDefaultCalendar(calendar: { name: string; workingMinutesPerDay: number }) {
    this.calendars.push({ id: 'calendar-1', ...calendar });
    return { id: 'calendar-1' };
  }
  async grantRoleCapabilities(
    grants: readonly { role: string; capabilities: readonly string[] }[],
  ) {
    let added = 0;
    for (const grant of grants) {
      for (const capability of grant.capabilities) {
        const key = `${grant.role}:${capability}`;
        if (!this.grants.has(key)) added += 1;
        this.grants.add(key);
      }
    }
    return added;
  }
  async createOwner(owner: NewStudioOwner) {
    this.owners.push({ ...owner, id: 'owner-1' });
    this.phones.add(owner.phoneE164);
    return { id: 'owner-1' };
  }
}

const input: StudioSetupInput = {
  studioName: '  Saffron Studio ',
  ownerName: 'Meera Rao',
  ownerPhoneE164: '+919812345678',
  ownerEmail: 'meera@saffron.example',
  timeZone: 'Asia/Kolkata',
  currency: 'INR',
  projectReferencePrefix: 'SAF',
};

function setup() {
  const store = new InMemorySetupStore();
  const records = new RecordedEffects();
  const stores: SetupStores = { setup: store, records };
  const uow: UnitOfWork<SetupStores> = { stores, transaction: (work) => work(stores) };
  return { store, records, command: new SetUpStudioCommand(uow) };
}

describe('first-time studio setup', () => {
  it('creates settings, the studio week, role access and the owner, with no demo data', async () => {
    const { store, records, command } = setup();
    const result = await command.execute(input);
    expect(store.locks).toBe(1);
    expect(store.settings).toEqual({
      name: 'Saffron Studio',
      timeZone: 'Asia/Kolkata',
      currency: 'INR',
      projectReferencePrefix: 'SAF',
    });
    expect(store.calendars).toEqual([
      expect.objectContaining({ name: 'Studio week', workingMinutesPerDay: 480 }),
    ]);
    expect(store.owners).toEqual([
      expect.objectContaining({ fullName: 'Meera Rao', workingCalendarId: 'calendar-1' }),
    ]);
    // The owner role holds every capability.
    expect(CAPABILITIES.every((capability) => store.grants.has(`owner:${capability}`))).toBe(true);
    expect(result).toMatchObject({ ownerUserId: 'owner-1', calendarId: 'calendar-1' });
    expect(result.grantsAdded).toBe(store.grants.size);
    expect(records.audits).toEqual([
      expect.objectContaining({ action: 'studio.set_up', actorUserId: null }),
    ]);
  });

  it('refuses a second run and changes nothing', async () => {
    const { store, command } = setup();
    await command.execute(input);
    await expect(command.execute({ ...input, studioName: 'Another studio' })).rejects.toMatchObject(
      {
        code: 'CONFLICT',
        message: 'This installation is already set up, so nothing was changed.',
        details: [
          { message: 'Studio settings are already configured.' },
          { message: 'An owner account already exists.' },
          { message: 'A default working calendar already exists.' },
          { message: 'Someone already signs in with this phone number.' },
        ],
      },
    );
    expect(store.settings?.name).toBe('Saffron Studio');
    expect(store.owners).toHaveLength(1);
  });

  it('refuses when only an owner exists (a hand-made installation)', async () => {
    const { store, command } = setup();
    store.owners.push({
      id: 'o',
      fullName: 'Someone',
      phoneE164: '+919800000000',
      email: null,
      workingCalendarId: 'x',
    });
    await expect(command.execute(input)).rejects.toMatchObject({
      details: [{ message: 'An owner account already exists.' }],
    });
    expect(store.settings).toBeNull();
  });

  it('checks every detail before touching the database', async () => {
    const { store, command } = setup();
    await expect(
      command.execute({
        ...input,
        studioName: ' ',
        ownerPhoneE164: '98123',
        timeZone: 'India/Mumbai',
        currency: 'rupees',
        projectReferencePrefix: 'S',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [
        { field: 'studioName' },
        { field: 'ownerPhone' },
        { field: 'timezone' },
        { field: 'currency' },
        { field: 'referencePrefix' },
      ],
    });
    expect(store.locks).toBe(0);
  });
});
