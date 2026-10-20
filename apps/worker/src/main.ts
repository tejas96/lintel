import { loadEnvironment } from '@lintel/configuration';
import { createConsoleLogger, describeError } from './observability/worker-logger';
import { startWorkerProcess } from './worker-process';

/**
 * Lintel background worker: the Temporal worker (reminders, escalations,
 * push delivery, daily operations) plus the transactional outbox relay.
 *
 *   node --env-file=../../.env dist/main.js
 *
 * Production note: prebuild the workflow bundle with `bundleWorkflowCode`
 * (`pnpm --filter @lintel/worker build && pnpm --filter @lintel/worker bundle`);
 * with NODE_ENV=production the worker loads dist/workflow-bundle.js instead
 * of bundling at startup. Run one or more replicas; the relay is safe to run
 * concurrently (FOR UPDATE SKIP LOCKED) and workflow IDs are idempotent.
 */
async function main(): Promise<void> {
  const env = loadEnvironment();
  const logger = createConsoleLogger(env.LOG_LEVEL);
  if (!env.TEMPORAL_ENABLED) {
    throw new Error('TEMPORAL_ENABLED is false: the worker needs Temporal to run.');
  }
  const running = await startWorkerProcess(env, logger);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void running.shutdown(signal);
    });
  }
  try {
    await running.finished;
  } catch (error) {
    logger.error('Worker failed', { error: describeError(error) });
    process.exitCode = 1;
  }
  await running.shutdown('worker finished');
}

main().catch((error: unknown) => {
  console.error('Worker failed to start:', describeError(error));
  process.exit(1);
});
