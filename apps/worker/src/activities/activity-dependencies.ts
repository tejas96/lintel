import {
  type BackgroundStores,
  type NewNotification,
  type NotificationStore,
  Notifier,
  type PushProvider,
  type RecordStore,
  type SettingsStore,
  type UnitOfWork,
  type WorkflowScheduler,
} from '@lintel/application';
import type { WorkingCalendar } from '@lintel/domain';
import type { Clock } from '@lintel/shared';
import type { WorkerLogger } from '../observability/worker-logger';
import type { OrganizationContext } from './organization-context';

/** The stores activities use. `DrizzleUnitOfWork` (all application stores) satisfies it. */
export interface WorkerStores {
  readonly notifications: NotificationStore;
  readonly records: RecordStore;
  readonly settings: Pick<SettingsStore, 'organization' | 'defaultCalendar' | 'calendarsForUsers'>;
  readonly background: BackgroundStores;
}

/** Everything activities need, injected so each one is unit-testable with fakes. */
export interface ActivityDependencies {
  readonly uow: UnitOfWork<WorkerStores>;
  readonly clock: Clock;
  readonly push: PushProvider;
  readonly scheduler: WorkflowScheduler;
  readonly organization: OrganizationContext;
  readonly logger: WorkerLogger;
}

/**
 * Runs `work` in one transaction with a Notifier bound to it, so a re-check
 * of the business record and the notifications it causes commit together.
 * Dedupe keys make a retried activity safe; quiet hours and preferences come
 * from the notification policy.
 */
export async function withNotifier<T>(
  deps: ActivityDependencies,
  work: (stores: WorkerStores, notifier: Notifier) => Promise<T>,
): Promise<T> {
  const defaults = await deps.organization.notifierDefaults();
  return deps.uow.transaction((stores) =>
    work(stores, new Notifier(stores.notifications, stores.records, deps.clock, defaults)),
  );
}

export async function notifyEach(
  notifier: Notifier,
  notifications: readonly NewNotification[],
): Promise<number> {
  await notifier.notifyMany(notifications);
  return notifications.length;
}

/** The person's working calendar, or the studio default when they have none. */
export async function calendarFor(
  stores: Pick<WorkerStores, 'settings'>,
  userId: string | null,
): Promise<WorkingCalendar> {
  if (userId) {
    const calendars = await stores.settings.calendarsForUsers([userId]);
    const calendar = calendars.get(userId);
    if (calendar) return calendar;
  }
  return stores.settings.defaultCalendar();
}

/** Unique recipients, keeping order and dropping nulls. */
export function uniqueRecipients(ids: readonly (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}
