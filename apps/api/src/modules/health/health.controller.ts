import type { ObjectStorage, WorkflowScheduler } from '@lintel/application';
import type { Environment } from '@lintel/configuration';
import type { DatabaseConnection } from '@lintel/database';
import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Public } from '../../common/auth/auth.decorators';
import { ENVIRONMENT } from '../../config/configuration.module';
import { apiContract } from '../../contract';
import {
  DATABASE_CONNECTION,
  OBJECT_STORAGE,
  WORKFLOW_SCHEDULER,
} from '../../infrastructure/tokens';

const { health, readiness, aiStatus } = apiContract.platform;

async function withTimeout(check: Promise<boolean>, milliseconds = 2000): Promise<boolean> {
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), milliseconds));
  return Promise.race([check.catch(() => false), timeout]);
}

@Controller()
export class HealthController {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(WORKFLOW_SCHEDULER) private readonly scheduler: WorkflowScheduler,
    @Inject(ENVIRONMENT) private readonly env: Environment,
  ) {}

  @Public()
  @TsRestHandler(health)
  liveness() {
    return tsRestHandler(health, async () => ({ status: 200, body: { status: 'ok' as const } }));
  }

  @Public()
  @TsRestHandler(readiness)
  readiness() {
    return tsRestHandler(readiness, async () => {
      const [database, objectStorage, temporal] = await Promise.all([
        withTimeout(this.database.pool.query('select 1').then(() => true)),
        withTimeout(this.storage.checkHealth()),
        this.env.TEMPORAL_ENABLED
          ? withTimeout(this.scheduler.checkHealth())
          : Promise.resolve('disabled' as const),
      ]);
      const ready = database && objectStorage && temporal !== false;
      return {
        status: 200,
        body: {
          status: ready ? ('ready' as const) : ('degraded' as const),
          checks: { database, objectStorage, temporal },
        },
      };
    });
  }

  @TsRestHandler(aiStatus)
  aiStatus() {
    return tsRestHandler(aiStatus, async () => ({
      status: 200,
      body: {
        enabled: false as const,
        message: 'AI features are not enabled. They are planned for Phase 2.',
      },
    }));
  }
}
