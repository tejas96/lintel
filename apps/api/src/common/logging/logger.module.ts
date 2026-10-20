import type { Environment } from '@lintel/configuration';
import { LoggerModule } from 'nestjs-pino';

/** pino-pretty is a dev dependency; production images do not contain it. */
function prettyPrintAvailable(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

import { ENVIRONMENT } from '../../config/configuration.module';
import { resolveRequestId } from '../http/request-context.middleware';

/**
 * Structured JSON logs. Secrets are redacted at the logger, so a mistake in
 * a handler cannot leak tokens, cookies or OTP codes.
 */
export const StructuredLoggerModule = LoggerModule.forRootAsync({
  inject: [ENVIRONMENT],
  useFactory: (env: Environment) => ({
    pinoHttp: {
      level: env.LOG_LEVEL,
      genReqId: (request, response) => resolveRequestId(request, response),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-lintel-csrf"]',
          'res.headers["set-cookie"]',
          'req.body.code',
          'req.body.sessionToken',
        ],
        censor: '[redacted]',
      },
      serializers: {
        req: (request: { method: string; url: string; id: string }) => ({
          id: request.id,
          method: request.method,
          url: request.url.split('?')[0],
        }),
        res: (response: { statusCode: number }) => ({ statusCode: response.statusCode }),
      },
      autoLogging: { ignore: (request) => (request.url ?? '').startsWith('/v1/health') },
      ...(env.NODE_ENV === 'development' && prettyPrintAvailable()
        ? {
            transport: {
              target: 'pino-pretty',
              options: { singleLine: true, translateTime: 'HH:MM:ss' },
            },
          }
        : {}),
    },
  }),
});
