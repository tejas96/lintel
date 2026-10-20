import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { WorkflowHandle } from '@temporalio/client';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import {
  bundleWorkflowCode,
  DefaultLogger,
  Runtime,
  Worker,
  type WorkflowBundle,
} from '@temporalio/worker';

/**
 * Lintel's local Temporal dev server. Always explicit: the SDK default
 * (localhost:7233) may be another project's server on this machine.
 */
export const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? '127.0.0.1:7240';
export const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? 'lintel';

const WORKFLOWS_PATH = resolve(process.cwd(), 'src/workflows/index.ts');

let runtimeInstalled = false;

/** Quiet SDK logs in tests (warnings and errors only). */
export function installTestRuntime(): void {
  if (runtimeInstalled) return;
  Runtime.install({ logger: new DefaultLogger('WARN') });
  runtimeInstalled = true;
}

export function uniqueTaskQueue(name: string): string {
  return `lintel-worker-test-${name}-${randomUUID().slice(0, 8)}`;
}

export function uniqueWorkflowId(name: string): string {
  return `test-${name}-${randomUUID()}`;
}

export async function connectTestEnvironment(): Promise<TestWorkflowEnvironment> {
  installTestRuntime();
  return TestWorkflowEnvironment.createFromExistingServer({
    address: TEMPORAL_ADDRESS,
    namespace: TEMPORAL_NAMESPACE,
  });
}

/** Bundles `src/workflows` once per test file (the same code the worker runs). */
export async function bundleTestWorkflows(): Promise<WorkflowBundle> {
  installTestRuntime();
  return bundleWorkflowCode({ workflowsPath: WORKFLOWS_PATH, logger: new DefaultLogger('WARN') });
}

export async function createTestWorker(
  env: TestWorkflowEnvironment,
  options: { taskQueue: string; bundle: WorkflowBundle; activities: object },
): Promise<Worker> {
  return Worker.create({
    connection: env.nativeConnection,
    namespace: TEMPORAL_NAMESPACE,
    taskQueue: options.taskQueue,
    workflowBundle: options.bundle,
    activities: options.activities,
  });
}

/** Terminates workflows a test started if they are still running. */
export async function terminateAll(handles: readonly WorkflowHandle[]): Promise<void> {
  for (const handle of handles) {
    try {
      const description = await handle.describe();
      if (description.status.name === 'RUNNING') await handle.terminate('test cleanup');
    } catch {
      // Already gone.
    }
  }
}

/** Polls until `check` passes or the timeout expires. */
export async function eventually<T>(
  check: () => T | Promise<T>,
  { timeoutMs = 15_000, intervalMs = 100 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      return await check();
    } catch (error) {
      lastError = error;
    }
    await new Promise((done) => setTimeout(done, intervalMs));
  }
  throw lastError instanceof Error ? lastError : new Error('Timed out waiting for a condition.');
}
