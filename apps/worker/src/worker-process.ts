import type { Environment } from '@lintel/configuration';
import { createDatabaseConnection, DrizzleUnitOfWork } from '@lintel/database';
import { TemporalWorkflowScheduler } from '@lintel/integrations';
import { systemClock } from '@lintel/shared';
import { Client, Connection } from '@temporalio/client';
import { NativeConnection, Runtime, Worker } from '@temporalio/worker';
import { createActivities, OrganizationContext } from './activities';
import { createMaintenanceDependencies } from './maintenance.factory';
import { describeError, type WorkerLogger } from './observability/worker-logger';
import { createPushProvider } from './push-provider.factory';
import { OutboxRelay } from './relay/outbox-relay';
import {
  DAILY_OPERATIONS_SCHEDULE_ID,
  ensureDailyOperationsSchedule,
  PERIODIC_REWARDS_SCHEDULE_ID,
} from './schedules/daily-operations.schedule';
import { ensurePeriodicRewardsSchedule } from './schedules/periodic-rewards.schedule';
import { temporalSdkLogger } from './temporal-logging';
import { workflowSource } from './workflow-source';

export interface RunningWorker {
  /** Settles when both the Temporal worker and the outbox relay have stopped. */
  readonly finished: Promise<void>;
  /** Graceful and idempotent: stop the relay, drain the worker, close connections. */
  shutdown(reason: string): Promise<void>;
}

async function businessTimeZone(organization: OrganizationContext, fallback: string) {
  try {
    return (await organization.settings()).timeZone;
  } catch {
    return fallback;
  }
}

/** Wires adapters, the Temporal worker, the daily Schedule and the outbox relay. */
export async function startWorkerProcess(
  env: Environment,
  logger: WorkerLogger,
): Promise<RunningWorker> {
  // The process owns SIGINT/SIGTERM (see main.ts) so shutdown happens in a known order.
  Runtime.install({ logger: temporalSdkLogger(logger, env.LOG_LEVEL), shutdownSignals: [] });
  const database = createDatabaseConnection(env.DATABASE_URL, { max: 10 });
  const uow = new DrizzleUnitOfWork(database.db);
  const push = createPushProvider(env, logger);
  const temporal = {
    address: env.TEMPORAL_ADDRESS,
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue: env.TEMPORAL_TASK_QUEUE,
  };
  const scheduler = new TemporalWorkflowScheduler(temporal);
  const organization = new OrganizationContext(uow.stores.settings, systemClock, {
    smsConfigured: env.SMS_NOTIFICATIONS_ENABLED,
  });
  const activities = createActivities(
    { uow, clock: systemClock, push, scheduler, organization, logger },
    createMaintenanceDependencies({ database, uow, clock: systemClock, logger, organization }),
  );

  const nativeConnection = await NativeConnection.connect({ address: temporal.address });
  const worker = await Worker.create({
    connection: nativeConnection,
    namespace: temporal.namespace,
    taskQueue: temporal.taskQueue,
    activities,
    ...workflowSource(env.NODE_ENV),
  });
  const clientConnection = await Connection.connect({ address: temporal.address });
  const client = new Client({ connection: clientConnection, namespace: temporal.namespace });
  const timeZone = await businessTimeZone(organization, env.BUSINESS_TIMEZONE);
  const schedule = await ensureDailyOperationsSchedule(client, {
    scheduleId: DAILY_OPERATIONS_SCHEDULE_ID,
    taskQueue: temporal.taskQueue,
    timeZone,
  });
  const rewardsSchedule = await ensurePeriodicRewardsSchedule(client, {
    scheduleId: PERIODIC_REWARDS_SCHEDULE_ID,
    taskQueue: temporal.taskQueue,
    timeZone,
  });
  logger.info('Schedules ready', { daily: schedule, periodicRewards: rewardsSchedule, timeZone });

  const relay = new OutboxRelay({ uow, scheduler, clock: systemClock, logger });
  const workerRun = worker.run();
  const relayRun = relay.run();
  logger.info('Worker running', {
    taskQueue: temporal.taskQueue,
    namespace: temporal.namespace,
    pushProvider: push.name,
  });

  let stopping: Promise<void> | null = null;
  const shutdown = (reason: string): Promise<void> => {
    stopping ??= (async () => {
      logger.info('Shutting down', { reason });
      relay.stop();
      if (worker.getState() === 'RUNNING') worker.shutdown();
      const results = await Promise.allSettled([workerRun, relayRun]);
      for (const result of results) {
        if (result.status === 'rejected') {
          logger.error('Stopped with an error', { error: describeError(result.reason) });
        }
      }
      await Promise.allSettled([
        scheduler.close(),
        clientConnection.close(),
        nativeConnection.close(),
        push.close?.(),
      ]);
      await database.close();
      logger.info('Worker stopped');
    })();
    return stopping;
  };
  const finished = Promise.all([workerRun, relayRun]).then(() => undefined);
  return { finished, shutdown };
}
