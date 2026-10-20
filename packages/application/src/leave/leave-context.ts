import { type Capability, DEFAULT_WORKING_CALENDAR, type WorkingCalendar } from '@lintel/domain';
import {
  type CalendarDate,
  type Clock,
  calendarDateInTimeZone,
  ForbiddenError,
  NotFoundError,
} from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { NotifierFactory } from '../notifications/notifier-factory';
import type { PersonRecord } from '../people/people.store';
import type { SettingsStore } from '../settings/settings.store';

/** The stores the leave use cases touch. */
export type LeaveStores = Pick<
  ApplicationStores,
  'leave' | 'people' | 'settings' | 'records' | 'notifications' | 'access'
>;

export interface LeaveDependencies {
  readonly uow: UnitOfWork<LeaveStores>;
  readonly clock: Clock;
  readonly notifierFor: NotifierFactory;
}

export async function businessToday(settings: SettingsStore, clock: Clock): Promise<CalendarDate> {
  const organization = await settings.organization();
  return calendarDateInTimeZone(clock.now(), organization.timeZone);
}

export async function calendarOf(
  settings: SettingsStore,
  userId: string,
): Promise<WorkingCalendar> {
  const calendars = await settings.calendarsForUsers([userId]);
  return calendars.get(userId) ?? DEFAULT_WORKING_CALENDAR;
}

export function hasCapability(context: RequestContext, capability: Capability): boolean {
  return context.actor.capabilities.has(capability);
}

export function requireCapability(context: RequestContext, capability: Capability): void {
  if (!hasCapability(context, capability)) throw new ForbiddenError();
}

/** The person, or "not found" when they do not exist. */
export async function requirePerson(
  stores: Pick<ApplicationStores, 'people'>,
  userId: string,
): Promise<PersonRecord> {
  const person = await stores.people.findById(userId);
  if (!person) throw new NotFoundError('Person');
  return person;
}

/** The manager a request routes to: only an active person counts. */
export async function activeManagerOf(
  stores: Pick<ApplicationStores, 'people'>,
  person: PersonRecord,
): Promise<string | null> {
  if (!person.reportsToUserId) return null;
  const manager = await stores.people.findById(person.reportsToUserId);
  return manager?.status === 'active' ? manager.id : null;
}
