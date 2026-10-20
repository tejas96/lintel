import type { Environment } from '@lintel/configuration';
import {
  createDatabaseConnection,
  type DatabaseConnection,
  DrizzleUnitOfWork,
} from '@lintel/database';
import { HmacSecretHasher, TemporalWorkflowScheduler } from '@lintel/integrations';
import { systemClock } from '@lintel/shared';
import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ENVIRONMENT } from '../config/configuration.module';
import { adapterFactory } from './adapter.factory';
import { BusinessContextService } from './business-context.service';
import {
  CLOCK,
  DATABASE_CONNECTION,
  FEATURE_FLAGS,
  OBJECT_STORAGE,
  OTP_PROVIDER,
  PUSH_PROVIDER,
  RANDOM_SOURCE,
  SECRET_HASHER,
  UNIT_OF_WORK,
  WORKFLOW_SCHEDULER,
} from './tokens';

/** Process-wide adapters. Each is a single instance managed by Nest's container. */
@Global()
@Module({
  providers: [
    BusinessContextService,
    {
      provide: DATABASE_CONNECTION,
      inject: [ENVIRONMENT],
      useFactory: (env: Environment) => createDatabaseConnection(env.DATABASE_URL),
    },
    {
      provide: UNIT_OF_WORK,
      inject: [DATABASE_CONNECTION],
      useFactory: (connection: DatabaseConnection) => new DrizzleUnitOfWork(connection.db),
    },
    { provide: CLOCK, useValue: systemClock },
    {
      provide: SECRET_HASHER,
      inject: [ENVIRONMENT],
      useFactory: (env: Environment) => new HmacSecretHasher(env.SESSION_SECRET),
    },
    { provide: RANDOM_SOURCE, inject: [ENVIRONMENT], useFactory: adapterFactory.randomSource },
    { provide: OTP_PROVIDER, inject: [ENVIRONMENT], useFactory: adapterFactory.otpProvider },
    { provide: OBJECT_STORAGE, inject: [ENVIRONMENT], useFactory: adapterFactory.objectStorage },
    { provide: PUSH_PROVIDER, inject: [ENVIRONMENT], useFactory: adapterFactory.pushProvider },
    { provide: FEATURE_FLAGS, inject: [ENVIRONMENT], useFactory: adapterFactory.featureFlags },
    {
      provide: WORKFLOW_SCHEDULER,
      inject: [ENVIRONMENT],
      useFactory: (env: Environment) =>
        new TemporalWorkflowScheduler({
          address: env.TEMPORAL_ADDRESS,
          namespace: env.TEMPORAL_NAMESPACE,
          taskQueue: env.TEMPORAL_TASK_QUEUE,
        }),
    },
  ],
  exports: [
    BusinessContextService,
    DATABASE_CONNECTION,
    UNIT_OF_WORK,
    CLOCK,
    SECRET_HASHER,
    RANDOM_SOURCE,
    OTP_PROVIDER,
    OBJECT_STORAGE,
    PUSH_PROVIDER,
    FEATURE_FLAGS,
    WORKFLOW_SCHEDULER,
  ],
})
export class InfrastructureModule implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(InfrastructureModule.name);

  constructor(
    @Inject(ENVIRONMENT) private readonly env: Environment,
    @Inject(DATABASE_CONNECTION) private readonly connection: DatabaseConnection,
    @Inject(OBJECT_STORAGE)
    private readonly storage: ReturnType<typeof adapterFactory.objectStorage>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.env.STORAGE_AUTO_CREATE_BUCKET) return;
    try {
      await this.storage.ensureBucket();
    } catch (error) {
      this.logger.warn(
        `Object storage is not reachable yet: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.connection.close();
  }
}
