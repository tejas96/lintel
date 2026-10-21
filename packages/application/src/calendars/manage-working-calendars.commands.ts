import { normalizeWeekdays, validateWorkingWeek, type WorkingWeek } from '@lintel/domain';
import {
  ConflictError,
  definedOnly,
  NotFoundError,
  type Patch,
  PreconditionFailedError,
  StaleVersionError,
  ValidationFailedError,
} from '@lintel/shared';
import { requireCapability } from '../common/capability-guard';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { WorkingCalendarRecord } from './working-calendar.store';

type CalendarStores = Pick<ApplicationStores, 'calendars' | 'settings' | 'records'>;

export interface WorkingCalendarInput extends WorkingWeek {
  readonly name: string;
}

export interface WorkingCalendarUpdate {
  readonly version: number;
  readonly changes: Patch<WorkingCalendarInput>;
}

const FIELDS: readonly (keyof WorkingCalendarInput)[] = [
  'name',
  'workingWeekdays',
  'dayStartTime',
  'dayEndTime',
  'workingMinutesPerDay',
];

function inputOf(record: WorkingCalendarRecord): WorkingCalendarInput {
  return {
    name: record.name,
    workingWeekdays: record.workingWeekdays,
    dayStartTime: record.dayStartTime,
    dayEndTime: record.dayEndTime,
    workingMinutesPerDay: record.workingMinutesPerDay,
  };
}

function normalise(input: WorkingCalendarInput): WorkingCalendarInput {
  return {
    ...input,
    name: input.name.trim(),
    workingWeekdays: normalizeWeekdays(input.workingWeekdays),
  };
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertValid(input: WorkingCalendarInput, others: readonly WorkingCalendarRecord[]): void {
  const problems: { field: string; message: string }[] = validateWorkingWeek(input).map(
    (problem) => ({ ...problem }),
  );
  if (input.name.length < 2 || input.name.length > 60) {
    problems.unshift({ field: 'name', message: 'Use 2 to 60 characters.' });
  }
  if (problems.length > 0) throw new ValidationFailedError('Check the working week.', problems);
  const name = input.name.toLocaleLowerCase();
  if (others.some((other) => other.name.toLocaleLowerCase() === name)) {
    throw new ConflictError('Another working week already has this name.', [
      { field: 'name', message: 'Choose a name no other working week uses.' },
    ]);
  }
}

/**
 * The studio week and other working weeks (part-time, site teams). Capacity,
 * planning, leave and reminders read calendars when they run, so a change
 * applies from the next calculation on; dates already planned do not move.
 */
export class ManageWorkingCalendarsCommands {
  constructor(private readonly uow: UnitOfWork<CalendarStores>) {}

  async create(context: RequestContext, input: WorkingCalendarInput) {
    requireCapability(context, 'organization.manage_settings');
    const clean = normalise(input);
    return this.uow.transaction(async (stores) => {
      assertValid(clean, await stores.calendars.list());
      const { timeZone } = await stores.settings.organization();
      const created = await stores.calendars.create({ ...clean, timeZone });
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'working_calendar.created',
        entityType: 'working_calendar',
        entityId: created.id,
        after: { ...inputOf(created) },
        requestId: context.requestId,
      });
      return created;
    });
  }

  async update(context: RequestContext, calendarId: string, input: WorkingCalendarUpdate) {
    requireCapability(context, 'organization.manage_settings');
    return this.uow.transaction(async (stores) => {
      const before = await this.load(stores, calendarId, input.version);
      const merged = normalise({ ...inputOf(before), ...definedOnly(input.changes) });
      const others = (await stores.calendars.list()).filter((other) => other.id !== before.id);
      assertValid(merged, others);
      const changed = FIELDS.filter((field) => !sameValue(merged[field], before[field]));
      if (changed.length === 0) return before;
      const changes = Object.fromEntries(changed.map((field) => [field, merged[field]]));
      const after = await stores.calendars.update(before.id, before.version, changes);
      if (!after) throw new StaleVersionError('This working week');
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'working_calendar.updated',
        entityType: 'working_calendar',
        entityId: before.id,
        before: Object.fromEntries(changed.map((field) => [field, before[field]])),
        after: changes,
        requestId: context.requestId,
      });
      return after;
    });
  }

  /** Only an unused, non-default working week can be removed. */
  async remove(context: RequestContext, calendarId: string): Promise<void> {
    requireCapability(context, 'organization.manage_settings');
    await this.uow.transaction(async (stores) => {
      const calendar = await stores.calendars.find(calendarId);
      if (!calendar) throw new NotFoundError('Working week');
      if (calendar.isDefault) {
        throw new PreconditionFailedError('The studio week cannot be removed; edit it instead.');
      }
      if (calendar.peopleCount > 0) {
        const people = calendar.peopleCount === 1 ? '1 person' : `${calendar.peopleCount} people`;
        throw new PreconditionFailedError(
          `${people} still follow this week. Move them to another working week first.`,
        );
      }
      await stores.calendars.remove(calendarId);
      await stores.records.appendAudit({
        actorUserId: context.actor.userId,
        action: 'working_calendar.removed',
        entityType: 'working_calendar',
        entityId: calendarId,
        before: { ...inputOf(calendar) },
        requestId: context.requestId,
      });
    });
  }

  private async load(stores: CalendarStores, calendarId: string, version: number) {
    const calendar = await stores.calendars.find(calendarId);
    if (!calendar) throw new NotFoundError('Working week');
    if (calendar.version !== version) throw new StaleVersionError('This working week');
    return calendar;
  }
}
