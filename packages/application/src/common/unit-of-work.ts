import type { ProjectAccessStore } from '../access/project-access.store';
import type { IdentityStore } from '../identity/identity.store';
import type { LeaveStore } from '../leave/leave.store';
import type { NotificationStore } from '../notifications/notification.store';
import type { NotificationInboxStore } from '../notifications/notification-inbox.store';
import type { CapacityReadStore } from '../operations/capacity.store';
import type { PeopleStore } from '../people/people.store';
import type { RewardStore } from '../rewards/reward.store';
import type { SettingsStore } from '../settings/settings.store';
import type { RecordStore } from './record.store';

/**
 * Every persistence port, bound to one database transaction. Feature modules
 * add their store here; use cases depend only on the stores they use.
 */
export interface ApplicationStores {
  readonly access: ProjectAccessStore;
  readonly capacity: CapacityReadStore;
  readonly identity: IdentityStore;
  readonly inbox: NotificationInboxStore;
  readonly leave: LeaveStore;
  readonly notifications: NotificationStore;
  readonly people: PeopleStore;
  readonly records: RecordStore;
  readonly rewards: RewardStore;
  readonly settings: SettingsStore;
}

/** Runs work atomically: every store write commits together or not at all. */
export interface UnitOfWork<TStores = ApplicationStores> {
  transaction<T>(work: (stores: TStores) => Promise<T>): Promise<T>;
  /** Stores outside a transaction, for reads and single-statement writes. */
  readonly stores: TStores;
}
