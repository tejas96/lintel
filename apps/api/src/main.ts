import 'reflect-metadata';
import { type Environment, loadEnvironment } from '@lintel/configuration';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { mountOpenApi } from './openapi';

async function bootstrap(): Promise<void> {
  const env: Environment = loadEnvironment();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app, env);
  if (env.NODE_ENV !== 'production') mountOpenApi(app);
  await app.listen(env.API_PORT, '0.0.0.0');
}

bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
