import { z } from 'zod';
import { booleanFlag, timeOfDay } from './environment-primitives';

/** "Lintel <notifications@studio.example.com>" or a bare address. */
const SENDER = /^(?:[^<>@\r\n]+<)?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/;

/**
 * SMS and email notification channels (see docs/INTEGRATIONS.md). Both are
 * off by default; development adapters record messages instead of sending.
 * `SMS_NOTIFICATIONS_ENABLED` itself lives in the main schema.
 */
export const notificationChannelVariables = {
  SMS_PROVIDER: z.enum(['log', 'msg91']).default('log'),
  /** MSG91 SMS template (Send SMS / flow API). Its DLT registration is linked in the MSG91 panel. */
  MSG91_SMS_TEMPLATE_ID: z.string().min(5).optional(),
  /** The DLT template ID registered for that template (India). Recorded with every attempt. */
  MSG91_SMS_DLT_TEMPLATE_ID: z
    .string()
    .regex(/^\d{10,30}$/, 'DLT template IDs are numeric.')
    .optional(),

  EMAIL_NOTIFICATIONS_ENABLED: booleanFlag.default('false'),
  EMAIL_PROVIDER: z.enum(['log', 'smtp']).default('log'),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  /** TLS from the first byte (port 465). Defaults to true only for port 465. */
  SMTP_SECURE: booleanFlag.optional(),
  /** On a plain connection, refuse to send unless the server upgrades with STARTTLS. */
  SMTP_REQUIRE_TLS: booleanFlag.default('true'),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.string().regex(SENDER, 'Use "Name <address@domain>" or an address.').optional(),
  SMTP_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(15_000),
  /** When the daily digest goes out, in the business timezone. */
  EMAIL_DIGEST_TIME: timeOfDay.default('18:00'),
} as const;

const channelSchema = z.object(notificationChannelVariables);
type ChannelEnvironment = z.infer<typeof channelSchema> & {
  readonly NODE_ENV: string;
  readonly WEB_BASE_URL: string;
  readonly SMS_NOTIFICATIONS_ENABLED: boolean;
  readonly MSG91_AUTH_KEY?: string | undefined;
};

/** True when SMTP runs over TLS from the start (explicitly, or port 465). */
export function smtpUsesImplicitTls(env: Pick<ChannelEnvironment, 'SMTP_SECURE' | 'SMTP_PORT'>) {
  return env.SMTP_SECURE ?? env.SMTP_PORT === 465;
}

function providerProblems(env: ChannelEnvironment): string[] {
  const problems: string[] = [];
  const msg91Ready =
    env.MSG91_AUTH_KEY && env.MSG91_SMS_TEMPLATE_ID && env.MSG91_SMS_DLT_TEMPLATE_ID;
  if (env.SMS_PROVIDER === 'msg91' && !msg91Ready) {
    problems.push(
      'MSG91_AUTH_KEY, MSG91_SMS_TEMPLATE_ID and MSG91_SMS_DLT_TEMPLATE_ID are required when SMS_PROVIDER=msg91.',
    );
  }
  if (env.EMAIL_PROVIDER === 'smtp' && (!env.SMTP_HOST || !env.SMTP_FROM)) {
    problems.push('SMTP_HOST and SMTP_FROM are required when EMAIL_PROVIDER=smtp.');
  }
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) {
    problems.push('Set both SMTP_USER and SMTP_PASSWORD, or neither.');
  }
  return problems;
}

function productionProblems(env: ChannelEnvironment): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const messagesEnabled = env.SMS_NOTIFICATIONS_ENABLED || env.EMAIL_NOTIFICATIONS_ENABLED;
  const checks: [boolean, string][] = [
    [
      env.SMS_NOTIFICATIONS_ENABLED && env.SMS_PROVIDER !== 'msg91',
      'SMS_PROVIDER must be msg91 when SMS notifications are enabled in production.',
    ],
    [
      env.EMAIL_NOTIFICATIONS_ENABLED && env.EMAIL_PROVIDER !== 'smtp',
      'EMAIL_PROVIDER must be smtp when email notifications are enabled in production.',
    ],
    [
      env.EMAIL_PROVIDER === 'smtp' && !smtpUsesImplicitTls(env) && !env.SMTP_REQUIRE_TLS,
      'SMTP must use TLS in production: set SMTP_SECURE=true (port 465) or SMTP_REQUIRE_TLS=true.',
    ],
    [
      messagesEnabled && !env.WEB_BASE_URL.startsWith('https://'),
      'WEB_BASE_URL must be the public https:// address when SMS or email notifications are enabled.',
    ],
  ];
  return checks.filter(([failed]) => failed).map(([, message]) => message);
}

/** Configuration problems of the SMS and email channels (all environments + production). */
export function notificationChannelProblems(env: ChannelEnvironment): string[] {
  return [...providerProblems(env), ...productionProblems(env)];
}
