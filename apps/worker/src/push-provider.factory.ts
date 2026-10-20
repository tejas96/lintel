import type { PushProvider } from '@lintel/application';
import type { Environment } from '@lintel/configuration';
import { FirebasePushProvider, LogPushProvider } from '@lintel/integrations';
import type { WorkerLogger } from './observability/worker-logger';

/**
 * Same rule as the API's adapter factory: real FCM only when it is fully
 * configured, otherwise the development log provider, which reports
 * `not_configured` so deliveries are recorded as skipped, never as sent.
 * (`loadEnvironment` already refuses PUSH_PROVIDER=log in production.)
 */
export function createPushProvider(
  env: Environment,
  logger: WorkerLogger,
): PushProvider & { close?: () => Promise<void> } {
  if (
    env.PUSH_PROVIDER === 'fcm' &&
    env.FIREBASE_PROJECT_ID &&
    env.FIREBASE_CLIENT_EMAIL &&
    env.FIREBASE_PRIVATE_KEY
  ) {
    return new FirebasePushProvider({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    });
  }
  return new LogPushProvider({ log: (message) => logger.info(message, { provider: 'log' }) });
}
