import 'reflect-metadata';
import { type Environment, loadEnvironment } from '@lintel/configuration';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { mountOpenApi } from './openapi';

async function bootstrap(): Promise<void> {
  const env: Environment = loadEnvironment();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.set('trust proxy', env.TRUST_PROXY ? 1 : false);
  app.disable('x-powered-by');
  // Swagger UI needs inline scripts, so the CSP is relaxed outside production only.
  app.use(helmet(env.NODE_ENV === 'production' ? {} : { contentSecurityPolicy: false }));
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
    exposedHeaders: ['x-request-id', 'retry-after'],
  });
  app.enableShutdownHooks();
  if (env.NODE_ENV !== 'production') mountOpenApi(app);
  await app.listen(env.API_PORT, '0.0.0.0');
}

bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
