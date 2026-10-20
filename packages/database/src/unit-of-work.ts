import type { ApplicationStores, UnitOfWork } from '@lintel/application';
import type { Database, DatabaseExecutor } from './client';
import { CapacityReadRepository } from './repositories/capacity-read.repository';
import { IdentityRepository } from './repositories/identity.repository';
import { LeaveRepository } from './repositories/leave.repository';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationInboxRepository } from './repositories/notification-inbox.repository';
import { PeopleRepository } from './repositories/people.repository';
import { ProjectAccessRepository } from './repositories/project-access.repository';
import { RecordRepository } from './repositories/record.repository';
import { RewardRepository } from './repositories/reward.repository';
import { SettingsRepository } from './repositories/settings.repository';

/** Builds every repository on top of one executor (the pool or a transaction). */
export function createStores(executor: DatabaseExecutor): ApplicationStores {
  return {
    access: new ProjectAccessRepository(executor),
    capacity: new CapacityReadRepository(executor),
    identity: new IdentityRepository(executor),
    inbox: new NotificationInboxRepository(executor),
    leave: new LeaveRepository(executor),
    notifications: new NotificationRepository(executor),
    people: new PeopleRepository(executor),
    records: new RecordRepository(executor),
    rewards: new RewardRepository(executor),
    settings: new SettingsRepository(executor),
  };
}

export class DrizzleUnitOfWork implements UnitOfWork<ApplicationStores> {
  readonly stores: ApplicationStores;

  constructor(private readonly db: Database) {
    this.stores = createStores(db);
  }

  transaction<T>(work: (stores: ApplicationStores) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(createStores(tx)));
  }
}
