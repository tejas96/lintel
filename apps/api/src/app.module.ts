import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TsRestModule } from '@ts-rest/nest';
import { SessionGuard } from './common/auth/session.guard';
import { ApplicationErrorFilter } from './common/http/application-error.filter';
import { RequestIdMiddleware } from './common/http/request-context.middleware';
import { StructuredLoggerModule } from './common/logging/logger.module';
import { ConfigurationModule } from './config/configuration.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { AuthModule } from './modules/auth/auth.module';
import { FEATURE_MODULES } from './modules/feature-modules';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigurationModule,
    StructuredLoggerModule,
    InfrastructureModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 600 }]),
    TsRestModule.register({ isGlobal: true, validateResponses: true, jsonQuery: false }),
    AuthModule,
    HealthModule,
    ...FEATURE_MODULES,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ApplicationErrorFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
