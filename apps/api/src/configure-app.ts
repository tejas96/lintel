import type { Environment } from '@lintel/configuration';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { resolveRequestId } from './common/http/request-context.middleware';

/** HTTP-level setup shared by `main.ts` and the integration tests. */
export function configureApp(app: NestExpressApplication, env: Environment): void {
  app.set('trust proxy', env.TRUST_PROXY ? 1 : false);
  app.disable('x-powered-by');
  // Swagger UI needs inline scripts, so the CSP is relaxed outside production only.
  app.use(helmet(env.NODE_ENV === 'production' ? {} : { contentSecurityPolicy: false }));
  // Give every request its ID before body parsing, so even malformed-JSON errors carry one.
  app.use(
    (
      request: Parameters<typeof resolveRequestId>[0],
      response: Parameters<typeof resolveRequestId>[1],
      next: () => void,
    ) => {
      resolveRequestId(request, response);
      next();
    },
  );
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '1mb' });
  app.enableCors({
    origin: env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()),
    credentials: true,
    allowedHeaders: [
      'content-type',
      'authorization',
      'x-lintel-csrf',
      'x-request-id',
      'idempotency-key',
    ],
    exposedHeaders: ['x-request-id', 'retry-after', 'idempotent-replay'],
  });
  app.enableShutdownHooks();
}
