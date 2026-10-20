import type { PushMessage, PushProvider, PushResult } from '@lintel/application';

export interface PushLogger {
  log(message: string): void;
}

/**
 * Development push provider. It records what would be sent and reports
 * `not_configured`, so nobody mistakes it for real device delivery.
 */
export class LogPushProvider implements PushProvider {
  readonly name = 'log';
  readonly isDevelopmentOnly = true;

  constructor(private readonly logger: PushLogger) {}

  async send(message: PushMessage): Promise<PushResult> {
    this.logger.log(
      `[DEVELOPMENT ONLY] Push not sent (no FCM configured): "${message.title}" → ${message.linkPath ?? '/'}`,
    );
    return {
      outcome: 'not_configured',
      reason: 'Push delivery is not configured in this environment.',
    };
  }
}
