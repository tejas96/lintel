import { type CalendarDate, type Clock, calendarDateInTimeZone } from '@lintel/shared';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { Notifier } from '../notifications/notifier';

/** Builds a Notifier that writes through the given (transactional) stores. */
export type NotifierFactory = (
  stores: Pick<ApplicationStores, 'notifications' | 'records'>,
) => Promise<Notifier>;

/** What project and scope-change commands need from the outside world. */
export interface ProjectCommandDependencies {
  readonly uow: UnitOfWork<ApplicationStores>;
  readonly clock: Clock;
  readonly notifierFor: NotifierFactory;
}

/** Today's calendar date in the studio's business timezone. */
export async function businessToday(
  stores: Pick<ApplicationStores, 'settings'>,
  clock: Clock,
): Promise<CalendarDate> {
  const settings = await stores.settings.organization();
  return calendarDateInTimeZone(clock.now(), settings.timeZone);
}
