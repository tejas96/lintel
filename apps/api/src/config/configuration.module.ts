import { type Environment, loadEnvironment } from '@lintel/configuration';
import { Global, Module } from '@nestjs/common';

export const ENVIRONMENT = Symbol('ENVIRONMENT');

/** Validates configuration once at startup; the process exits on any problem. */
@Global()
@Module({
  providers: [{ provide: ENVIRONMENT, useFactory: (): Environment => loadEnvironment() }],
  exports: [ENVIRONMENT],
})
export class ConfigurationModule {}
