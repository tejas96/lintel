import type { ApplicationStores, UnitOfWork } from '@lintel/application';
import type { Database, DatabaseExecutor } from './client';
import { DeliverableRepository } from './repositories/deliverable.repository';
import { IdentityRepository } from './repositories/identity.repository';
import { NotificationRepository } from './repositories/notification.repository';
import { PeopleRepository } from './repositories/people.repository';
import { ProjectAccessRepository } from './repositories/project-access.repository';
import { RecordRepository } from './repositories/record.repository';
import { SettingsRepository } from './repositories/settings.repository';
import { TaskRepository } from './repositories/task.repository';
import { TaskItemRepository } from './repositories/task-item.repository';
import { WorkSessionRepository } from './repositories/work-session.repository';

/** Builds every repository on top of one executor (the pool or a transaction). */
export function createStores(executor: DatabaseExecutor): ApplicationStores {
  return {
    access: new ProjectAccessRepository(executor),
    identity: new IdentityRepository(executor),
    notifications: new NotificationRepository(executor),
    people: new PeopleRepository(executor),
    records: new RecordRepository(executor),
    settings: new SettingsRepository(executor),
    tasks: new TaskRepository(executor),
    taskItems: new TaskItemRepository(executor),
    workSessions: new WorkSessionRepository(executor),
    deliverables: new DeliverableRepository(executor),
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
