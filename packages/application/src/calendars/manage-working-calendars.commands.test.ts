import { describe, expect, it } from 'vitest';
import type { UnitOfWork } from '../common/unit-of-work';
import { InMemoryCalendarStore } from '../testing/in-memory-calendar.store';
import { contextFor, fakeSettings, person, RecordedEffects } from '../testing/leave-test-world';
import {
  ManageWorkingCalendarsCommands,
  type WorkingCalendarInput,
} from './manage-working-calendars.commands';

const siteWeek: WorkingCalendarInput = {
  name: '  Site team ',
  workingWeekdays: [6, 1, 2, 3, 4, 5, 1],
  dayStartTime: '08:00',
  dayEndTime: '17:00',
  workingMinutesPerDay: 480,
};

const admin = contextFor(person('admin', 'administrator'));
const lead = contextFor(person('lead', 'team_lead'));

function setup() {
  const calendars = new InMemoryCalendarStore();
  const records = new RecordedEffects();
  const stores = { calendars, records, settings: fakeSettings() };
  const uow: UnitOfWork<typeof stores> = { stores, transaction: (work) => work(stores) };
  return { calendars, records, commands: new ManageWorkingCalendarsCommands(uow) };
}

describe('working week administration', () => {
  it('adds a working week in the studio time zone, tidied and audited', async () => {
    const { commands, records } = setup();
    const created = await commands.create(admin, siteWeek);
    expect(created).toMatchObject({
      name: 'Site team',
      timeZone: 'Asia/Kolkata',
      workingWeekdays: [1, 2, 3, 4, 5, 6],
      isDefault: false,
    });
    expect(records.audits[0]?.action).toBe('working_calendar.created');
  });

  it('needs the studio settings capability', async () => {
    const { commands } = setup();
    await expect(commands.create(lead, siteWeek)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('explains an impossible week field by field', async () => {
    const { commands } = setup();
    await expect(
      commands.create(admin, {
        ...siteWeek,
        name: 'S',
        workingWeekdays: [],
        dayEndTime: '07:00',
        workingMinutesPerDay: 30,
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [
        { field: 'name' },
        { field: 'workingWeekdays' },
        { field: 'dayEndTime' },
        { field: 'workingMinutesPerDay' },
      ],
    });
    await expect(
      commands.create(admin, { ...siteWeek, name: 'studio WEEK' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', details: [{ field: 'name' }] });
  });

  it('edits the studio week with its version and records what changed', async () => {
    const { commands, records } = setup();
    const after = await commands.update(admin, 'studio', {
      version: 1,
      changes: { workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 450 },
    });
    expect(after).toMatchObject({ workingWeekdays: [1, 2, 3, 4, 5], version: 2 });
    expect(records.audits[0]).toMatchObject({
      action: 'working_calendar.updated',
      before: { workingWeekdays: [1, 2, 3, 4, 5, 6], workingMinutesPerDay: 480 },
      after: { workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 450 },
    });
    await expect(
      commands.update(admin, 'studio', { version: 1, changes: { dayStartTime: '10:00' } }),
    ).rejects.toMatchObject({ code: 'STALE_VERSION' });
    const unchanged = await commands.update(admin, 'studio', {
      version: 2,
      changes: { workingWeekdays: [5, 4, 3, 2, 1] },
    });
    expect(unchanged.version).toBe(2);
  });

  it('removes only unused weeks and never the studio week', async () => {
    const { commands, calendars } = setup();
    const created = await commands.create(admin, siteWeek);
    await expect(commands.remove(admin, 'studio')).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
    const index = calendars.calendars.findIndex((calendar) => calendar.id === created.id);
    calendars.calendars[index] = { ...created, peopleCount: 2 };
    await expect(commands.remove(admin, created.id)).rejects.toMatchObject({
      message: '2 people still follow this week. Move them to another working week first.',
    });
    calendars.calendars[index] = { ...created, peopleCount: 0 };
    await commands.remove(admin, created.id);
    expect(calendars.removed).toEqual([created.id]);
  });
});
