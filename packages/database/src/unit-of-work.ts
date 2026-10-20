import type { ApplicationStores, UnitOfWork } from '@lintel/application';
import type { Database, DatabaseExecutor } from './client';
import { IdentityRepository } from './repositories/identity.repository';
import { RecordRepository } from './repositories/record.repository';
import { SettingsRepository } from './repositories/settings.repository';

/** Builds every repository on top of one executor (the pool or a transaction). */
export function createStores(executor: DatabaseExecutor): ApplicationStores {
  return {
    identity: new IdentityRepository(executor),
    records: new RecordRepository(executor),
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
