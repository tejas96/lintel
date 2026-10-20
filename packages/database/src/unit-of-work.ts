import type { ApplicationStores, UnitOfWork } from '@lintel/application';
import type { Database, DatabaseExecutor } from './client';
import { DeliverableRepository } from './repositories/deliverable.repository';
import { IdentityRepository } from './repositories/identity.repository';
import { NotificationRepository } from './repositories/notification.repository';
import { PeopleRepository } from './repositories/people.repository';
import { ProjectRepository } from './repositories/project.repository';
import { ProjectAccessRepository } from './repositories/project-access.repository';
import { RecordRepository } from './repositories/record.repository';
import { ScopeChangeRepository } from './repositories/scope-change.repository';
import { SettingsRepository } from './repositories/settings.repository';
import { TaskRepository } from './repositories/task.repository';
import { TaskItemRepository } from './repositories/task-item.repository';
import { TemplateRepository } from './repositories/template.repository';
import { WorkSessionRepository } from './repositories/work-session.repository';
import { createBackgroundStores } from './worker/background-stores';

/** Builds every repository on top of one executor (the pool or a transaction). */
export function createStores(executor: DatabaseExecutor): ApplicationStores {
  return {
    access: new ProjectAccessRepository(executor),
    background: createBackgroundStores(executor),
    identity: new IdentityRepository(executor),
    notifications: new NotificationRepository(executor),
    people: new PeopleRepository(executor),
    projects: new ProjectRepository(executor),
    records: new RecordRepository(executor),
    scopeChanges: new ScopeChangeRepository(executor),
    settings: new SettingsRepository(executor),
    templates: new TemplateRepository(executor),
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
