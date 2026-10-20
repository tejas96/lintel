import type { CalendarDate, Clock } from '@lintel/shared';
import type { ApplicationStores, UnitOfWork } from '../common/unit-of-work';
import type { Notifier } from '../notifications/notifier';

/** Stores a Notifier writes through. */
export type NotifierStores = Pick<ApplicationStores, 'notifications' | 'records'>;

/** The stores the task, work and deliverable use cases rely on. */
export type OperationsStores = Pick<
  ApplicationStores,
  'access' | 'tasks' | 'taskItems' | 'workSessions' | 'deliverables' | 'records' | 'notifications'
>;

/**
 * Studio-wide context the operational use cases need: business-timezone
 * "today" and a Notifier bound to the current transaction's stores.
 */
export interface OperationsContext {
  today(): Promise<CalendarDate>;
  notifierFor(stores: NotifierStores): Promise<Notifier>;
}

/** Everything a task/work/deliverable command is constructed with. */
export interface OperationsDependencies {
  readonly uow: UnitOfWork<OperationsStores>;
  readonly clock: Clock;
  readonly context: OperationsContext;
}
