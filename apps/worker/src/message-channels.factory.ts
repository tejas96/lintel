import type { EmailSender, SmsSender } from '@lintel/application';
import { type Environment, smtpUsesImplicitTls } from '@lintel/configuration';
import {
  DevelopmentEmailSender,
  DevelopmentSmsSender,
  Msg91SmsSender,
  SmtpEmailSender,
} from '@lintel/integrations';
import { type MessageChannelDependencies, unconfiguredChannels } from './activities';
import type { WorkerLogger } from './observability/worker-logger';

function smsSender(env: Environment, logger: WorkerLogger): SmsSender {
  if (
    env.SMS_PROVIDER === 'msg91' &&
    env.MSG91_AUTH_KEY &&
    env.MSG91_SMS_TEMPLATE_ID &&
    env.MSG91_SMS_DLT_TEMPLATE_ID
  ) {
    return new Msg91SmsSender({
      baseUrl: env.MSG91_BASE_URL,
      authKey: env.MSG91_AUTH_KEY,
      templateId: env.MSG91_SMS_TEMPLATE_ID,
      dltTemplateId: env.MSG91_SMS_DLT_TEMPLATE_ID,
      timeoutMs: env.MSG91_TIMEOUT_MS,
    });
  }
  // loadEnvironment refuses SMS with the development sender in production, so
  // there the channel is off and nothing is ever planned for it.
  if (env.NODE_ENV === 'production') return unconfiguredChannels().sms;
  return new DevelopmentSmsSender(
    { info: (message) => logger.info(message, { channel: 'sms', provider: 'development' }) },
    env.NODE_ENV,
  );
}

function emailSender(
  env: Environment,
  logger: WorkerLogger,
): EmailSender & { close?(): Promise<void> } {
  if (env.EMAIL_PROVIDER === 'smtp' && env.SMTP_HOST && env.SMTP_FROM) {
    return new SmtpEmailSender({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: smtpUsesImplicitTls(env),
      requireTls: env.SMTP_REQUIRE_TLS,
      user: env.SMTP_USER ?? null,
      password: env.SMTP_PASSWORD ?? null,
      from: env.SMTP_FROM,
      timeoutMs: env.SMTP_TIMEOUT_MS,
    });
  }
  if (env.NODE_ENV === 'production') return unconfiguredChannels().email;
  return new DevelopmentEmailSender(
    { info: (message) => logger.info(message, { channel: 'email', provider: 'development' }) },
    env.NODE_ENV,
  );
}

/**
 * Same rule as every adapter: the real provider only when fully configured,
 * otherwise a development sender that records and reports `not_configured`
 * (deliveries are recorded as skipped, never as sent).
 */
export function createMessageChannels(
  env: Environment,
  logger: WorkerLogger,
): MessageChannelDependencies & { close(): Promise<void> } {
  const email = emailSender(env, logger);
  return {
    sms: smsSender(env, logger),
    email,
    webBaseUrl: env.WEB_BASE_URL,
    close: async () => {
      await email.close?.();
    },
  };
}
